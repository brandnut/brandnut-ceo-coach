import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Organization } from '@/contexts/AppContext'
import { storage, storageKeys } from '@/lib/storage'

interface AuthTokens {
  access_token: string
  refresh_token: string
}

interface UserInfo {
  id: string
  username: string
  email: string
  phone?: string
  full_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  last_login_at?: string
  roles?: Array<{
    id: string
    role_name: string
    scope: string
    is_active: boolean
  }>
  organizations?: Array<{
    id: string
    name: string
    description: string
    logo_url: string | null
    is_active: boolean
    max_members: number
    created_at: string
    updated_at: string
  }>
}

export function useAuthLogic() {
  const params = useParams()
  const [me, setMe] = useState<UserInfo | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isAuthenticated = !!tokens // 只要有token就认为是已认证


  // Fetch user data and organizations in parallel
  const fetchUserData = useCallback(async (accessToken: string): Promise<{ user: UserInfo, orgs: Organization[] }> => {
    // Get user data and organizations in parallel
    const [userResponse, orgResponse] = await Promise.all([
      fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }),
      fetch('/api/users/me/organizations', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
    ])

    if (!userResponse.ok) {
      throw new Error('Failed to get user data')
    }

    const userData = await userResponse.json()

    let organizations: Organization[] = []

    if (orgResponse.ok) {
      const orgData = await orgResponse.json()
      organizations = orgData.organizations || []
    }

    return { user: userData, orgs: organizations }
  }, [])

  // Update auth state with user data
  const updateAuthState = useCallback(async (newTokens: AuthTokens) => {
    try {
      const { user, orgs } = await fetchUserData(newTokens.access_token)

      setMe(user)
      setOrganizations(orgs)
      setTokens(newTokens)
      setIsLoading(false)

      // Only store auth_tokens in localStorage
      // User and organization data fetched fresh from API each time

      return { user, orgs }
    } catch (error) {
      throw error
    }
  }, [])

  
  // Logout
  const logout = useCallback(async () => {
    try {
      const tokens = storage.getItem(storageKeys.AUTH_TOKENS)
      if (tokens) {
        const { refresh_token } = JSON.parse(tokens)
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token }),
        })
      }
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      // Clear auth state - only auth_tokens stored in localStorage
      storage.removeItem(storageKeys.AUTH_TOKENS)
      setMe(null)
      setOrganizations([])
      setTokens(null)
      setIsLoading(false)
    }
  }, [])

  // Login function
  const login = useCallback(async (phone: string, code: string) => {
    try {
      const response = await fetch('https://brandnut.cn/ops/api/v1/auth/sms/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || data.error || 'Login failed')
      }

      const data = await response.json()
      const tokens: AuthTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      }

      storage.setItem(storageKeys.AUTH_TOKENS, JSON.stringify(tokens))
      storage.setItem(storageKeys.TUTORIAL_SHOWN, 'false')

      await updateAuthState(tokens)

      return data
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }, [updateAuthState])

  // Send SMS code
  const sendSmsCode = useCallback(async (phone: string) => {
    try {
      const response = await fetch('https://brandnut.cn/ops/api/v1/auth/sms/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || data.error || 'Failed to send SMS')
      }

      return await response.json()
    } catch (error) {
      console.error('Send SMS failed:', error)
      throw error
    }
  }, [])

  // Initialize auth state on mount and params change
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedTokens = storage.getItem(storageKeys.AUTH_TOKENS)
        if (!storedTokens) {
          setIsLoading(false)
          return
        }

        const parsedTokens: AuthTokens = JSON.parse(storedTokens)
        setTokens(parsedTokens)

        try {
          const { user, orgs } = await fetchUserData(parsedTokens.access_token)
          setMe(user)
          setOrganizations(orgs)
          setIsLoading(false)
        } catch (userError) {
          // Token invalid, try refresh
          try {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: parsedTokens.refresh_token }),
            })

            if (response.ok) {
              const data = await response.json()
              const newTokens: AuthTokens = {
                access_token: data.access_token,
                refresh_token: data.refresh_token || parsedTokens.refresh_token,
              }

              storage.setItem(storageKeys.AUTH_TOKENS, JSON.stringify(newTokens))

              const { user, orgs } = await fetchUserData(newTokens.access_token)
              setMe(user)
              setOrganizations(orgs)
              setTokens(newTokens)
              setIsLoading(false)
            } else {
              throw new Error('Token refresh failed')
            }
          } catch (refreshError) {
            storage.removeItem(storageKeys.AUTH_TOKENS)
            setMe(null)
            setOrganizations([])
            setTokens(null)
            setIsLoading(false)
          }
        }
      } catch (error) {
        console.error('Failed to load auth state:', error)
        setMe(null)
        setOrganizations([])
        setTokens(null)
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [params]) // Only re-run when params change

  return {
    isAuthenticated,
    isLoading,
    me,
    organizations,
    tokens,
    login,
    logout,
    sendSmsCode,
  }
}