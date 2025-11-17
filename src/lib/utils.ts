import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to get static asset URL with basePath
export function getAssetUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  return `${basePath}${path}`
}

// Helper function to get API URL with basePath
export function getApiUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  return `${basePath}${path}`
}

// Helper function to get auth headers (requires storage access)
export function getAuthHeaders(storage: any, storageKeys: any): Record<string, string> {
  const headers: Record<string, string> = {}

  const storedTokens = storage.getItem(storageKeys.AUTH_TOKENS)
  if (storedTokens) {
    try {
      const { access_token } = JSON.parse(storedTokens)
      headers['Authorization'] = `Bearer ${access_token}`
    } catch (error) {
      console.error('Error parsing tokens:', error)
    }
  }

  return headers
}
