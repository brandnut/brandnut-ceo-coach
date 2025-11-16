import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

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


  // Fetch user data and organizations separately
  const fetchUserData = useCallback(async (accessToken: string): Promise<{ user: UserInfo, orgs: Organization[] }> => {
    // Get user data
    const userResponse = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to get user data')
    }

    const userData = await userResponse.json()

    // Get user organizations separately
    const orgResponse = await fetch('/api/users/me/organizations', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    let organizations: Organization[] = []
    if (orgResponse.ok) {
      organizations = await orgResponse.json()
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

  // Refresh token
  const refreshToken = useCallback(async (refreshToken: string) => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        throw new Error('Token refresh failed')
      }

      const data = await response.json()
      const newTokens: AuthTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
      }

      localStorage.setItem('auth_tokens', JSON.stringify(newTokens))

      await updateAuthState(newTokens)
    } catch (error) {
      console.error('Token refresh failed:', error)
      // Clear auth state - only auth_tokens stored in localStorage
      localStorage.removeItem('auth_tokens')
      setMe(null)
      setOrganizations([])
      setTokens(null)
      setIsLoading(false)
    }
  }, [])

  
  // Load tokens from localStorage and verify
  const loadAuthState = useCallback(async () => {
    try {
      const storedTokens = localStorage.getItem('auth_tokens')
      if (!storedTokens) {
        setIsLoading(false)
        return
      }

      const parsedTokens: AuthTokens = JSON.parse(storedTokens)

      // 先设置tokens，让isAuthenticated变为true
      setTokens(parsedTokens)

      try {
        await updateAuthState(parsedTokens)
      } catch (userError) {
        // Token invalid, try refresh
        await refreshToken(parsedTokens.refresh_token)
      }
    } catch (error) {
      console.error('Failed to load auth state:', error)
      // 只在token解析失败时清空，网络错误不清空token
      setMe(null)
      setOrganizations([])
      setTokens(null)
      setIsLoading(false)
    }
  }, [])

  // Logout
  const logout = useCallback(async () => {
    try {
      const tokens = localStorage.getItem('auth_tokens')
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
      localStorage.removeItem('auth_tokens')
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

      localStorage.setItem('auth_tokens', JSON.stringify(tokens))
      localStorage.setItem('tutorial-shown', 'false')

      await updateAuthState(tokens)

      return data
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }, [])

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

  // Initialize auth state on mount
  useEffect(() => {
    loadAuthState()
  }, [loadAuthState])

  // Refresh on route parameter changes only
  useEffect(() => {
    if (isAuthenticated && tokens) {
      // Only refresh if token exists but user data is missing
      if (!me || organizations.length === 0) {
        loadAuthState().catch(console.error)
      }
    }
  }, [params]) // Only depend on params to avoid infinite loops

  return {
    isAuthenticated,
    isLoading,
    me,
    organizations,
    tokens,
    login,
    logout,
    sendSmsCode,
    refreshToken,
    loadAuthState,
  }
}