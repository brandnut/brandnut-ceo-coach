import { storage, storageKeys } from "./storage";
import { getApiUrl } from "./utils";

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// Lock to prevent concurrent token refreshes
let isRefreshing = false;
// Queue of failed requests to retry after refresh
let refreshSubscribers: Array<(token: string) => void> = [];

function getTokens(): AuthTokens | null {
  const storedTokens = storage.getItem(storageKeys.AUTH_TOKENS);
  if (!storedTokens) return null;

  try {
    return JSON.parse(storedTokens);
  } catch {
    return null;
  }
}

function setTokens(tokens: AuthTokens): void {
  storage.setItem(storageKeys.AUTH_TOKENS, JSON.stringify(tokens));
}

async function refreshAccessToken(): Promise<string> {
  // If already refreshing, wait for it to complete
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshSubscribers.push((token) => resolve(token));
    });
  }

  isRefreshing = true;

  try {
    const tokens = getTokens();
    if (!tokens) {
      throw new Error("No tokens available for refresh");
    }

    const response = await fetch(getApiUrl("/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    const newTokens: AuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token,
    };

    setTokens(newTokens);

    // Notify all waiting requests
    refreshSubscribers.forEach((callback) => callback(newTokens.access_token));
    refreshSubscribers = [];

    return newTokens.access_token;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Enhanced fetch with automatic token refresh on 401
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Add Authorization header
  const tokens = getTokens();
  const initWithAuth: RequestInit = init || {};

  if (tokens) {
    initWithAuth.headers = {
      ...(initWithAuth.headers as Record<string, string>),
      Authorization: `Bearer ${tokens.access_token}`,
    };
  }

  const response = await fetch(input, initWithAuth);

  // If 401, try to refresh token and retry
  if (response.status === 401 && tokens) {
    try {
      const newToken = await refreshAccessToken();

      // Retry original request with new token
      const retryInit: RequestInit = {
        ...initWithAuth,
        headers: {
          ...(initWithAuth.headers as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        },
      };

      return await fetch(input, retryInit);
    } catch (refreshError) {
      console.error("[API Client] Token refresh failed:", refreshError);

      // Clear tokens and redirect to login
      storage.removeItem(storageKeys.AUTH_TOKENS);
      if (typeof window !== "undefined") {
        window.location.href = getApiUrl("/login");
      }

      throw refreshError;
    }
  }

  return response;
}

/**
 * Upload file with automatic token refresh on 401
 * Returns a Promise that resolves with the response
 */
export function uploadWithRefresh(
  url: string,
  formData: FormData,
  options: {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const upload = async (attemptNumber = 1) => {
      const xhr = new XMLHttpRequest();

      // Add Authorization header
      const tokens = getTokens();
      if (tokens) {
        xhr.setRequestHeader("Authorization", `Bearer ${tokens.access_token}`);
      }

      // Track progress
      if (options.onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.floor((e.loaded / e.total) * 100);
            options.onProgress?.(percent);
          }
        };
      }

      // Handle abort signal
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          xhr.abort();
          reject(new DOMException("Aborted", "AbortError"));
        });
      }

      // Handle response
      xhr.onload = () => {
        if (xhr.status === 401 && attemptNumber === 1) {
          // Token expired, refresh and retry
          refreshAccessToken()
            .then(() => upload(2)) // Retry with new token
            .then(resolve)
            .catch(reject);
        } else if (xhr.status === 200) {
          resolve(xhr);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error"));
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

      xhr.open("POST", url);
      xhr.send(formData);
    };

    upload();
  });
}
