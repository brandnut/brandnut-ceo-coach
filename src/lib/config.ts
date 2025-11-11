/**
 * Configuration utilities for base path deployment
 */

// Get base path from environment variable
export const basePath = process.env.BASE_PATH || '';

/**
 * Get the full URL with base path prefix
 * @param path - The path to prefix with base path
 * @returns The full path with base prefix
 */
export function getBasePath(path: string = ''): string {
  // Remove leading slash from path to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  if (!basePath) {
    return `/${cleanPath}`;
  }

  return `${basePath}/${cleanPath}`;
}

/**
 * Get the base URL for API calls
 * @returns The base URL including base path if configured
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use current origin with base path
    return window.location.origin + getBasePath();
  }

  // Server-side: use NEXTAUTH_URL or fallback to localhost with base path
  const nextAuthUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return nextAuthUrl.replace(/\/$/, '') + getBasePath();
}

/**
 * Create a properly prefixed URL for navigation
 * @param path - The relative path
 * @returns The full path with base prefix
 */
export function createUrl(path: string): string {
  return getBasePath(path);
}