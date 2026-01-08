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
  if (tokens) {
    init = init || {};
    init.headers = {
      ...(init.headers as Record<string, string>),
      Authorization: `Bearer ${tokens.access_token}`,
    };
  }

  const response = await fetch(input, init);

  // If 401, try to refresh token and retry
  if (response.status === 401 && tokens) {
    try {
      const newToken = await refreshAccessToken();

      // Retry original request with new token
      const retryInit = {
        ...init,
        headers: {
          ...(init.headers as Record<string, string>),
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
 * Create an authenticated XMLHttpRequest with auto token refresh
 */
export function createAuthenticatedXHR(): {
  xhr: XMLHttpRequest;
  open: (
    method: string,
    url: string,
    async?: boolean,
    user?: string | null,
    password?: string | null
  ) => void;
} {
  const xhr = new XMLHttpRequest();
  const originalOpen = xhr.open;
  const originalSend = xhr.send;
  let hasRefreshed = false;

  return {
    xhr,
    open: (
      method: string,
      url: string,
      async?: boolean,
      user?: string | null,
      password?: string | null
    ) => {
      // Add Authorization header
      const tokens = getTokens();
      if (tokens) {
        xhr.setRequestHeader("Authorization", `Bearer ${tokens.access_token}`);
      }

      originalOpen.call(xhr, method, url, async ?? true, user, password);

      // Handle 401 response
      xhr.addEventListener("load", async function () {
        if (xhr.status === 401 && !hasRefreshed && getTokens()) {
          hasRefreshed = true;

          try {
            const newToken = await refreshAccessToken();

            // Retry with new token
            const retryXhr = new XMLHttpRequest();
            retryXhr.open(method, url, async ?? true, user, password);
            retryXhr.setRequestHeader(
              "Authorization",
              `Bearer ${newToken}`
            );

            // Copy all original headers
            const headers = xhr.getAllResponseHeaders();
            if (headers) {
              const headerLines = headers.split("\r\n");
              headerLines.forEach((line) => {
                const [name, value] = line.split(": ");
                if (name && value) {
                  retryXhr.setRequestHeader(name, value);
                }
              });
            }

            // Copy event listeners
            retryXhr.addEventListener("load", () => {
              Object.defineProperty(xhr, "status", { value: retryXhr.status });
              Object.defineProperty(xhr, "responseText", { value: retryXhr.responseText });
              Object.defineProperty(xhr, "response", { value: retryXhr.response });

              const event = new Event("load");
              xhr.dispatchEvent(event);
            });

            retryXhr.addEventListener("error", () => {
              const event = new Event("error");
              xhr.dispatchEvent(event);
            });

            retryXhr.addEventListener("abort", () => {
              const event = new Event("abort");
              xhr.dispatchEvent(event);
            });

            retryXhr.send((xhr as any)._sentData);
          } catch (refreshError) {
            console.error("[API Client] XHR token refresh failed:", refreshError);

            // Clear tokens and redirect to login
            storage.removeItem(storageKeys.AUTH_TOKENS);
            if (typeof window !== "undefined") {
              window.location.href = getApiUrl("/login");
            }
          }
        }
      });
    },
  };
}
