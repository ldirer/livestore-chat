import { useEffect, useState } from 'react'

export type StoreInfo = {
  type: string
  id: string
}

export type UserInfo = {
  id: string
  email: string
  username: string
}

export type UseCurrentUserStoresState =
  | {
      user: UserInfo | null
      stores: StoreInfo[]
      loading: true
      error: string | null
    }
  | {
      user: UserInfo
      stores: StoreInfo[]
      loading: false
      error: null
    }
  | {
      user: null
      stores: StoreInfo[]
      loading: false
      error: string
    }

/**
 * Hook to get current user info and their stores from /auth/me endpoint
 */
export const useCurrentUserStores = (): UseCurrentUserStoresState => {
  const [state, setState] = useState<UseCurrentUserStoresState>({
    user: null,
    stores: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    const fetchUserStores = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        const response = await fetch('/auth/me', {
          method: 'GET',
        })

        if (response.ok) {
          const data = await response.json()
          setState({
            user: data.user,
            stores: data.stores,
            loading: false,
            error: null,
          })
        } else {
          const data = await response.json()
          setState({
            user: null,
            stores: [],
            loading: false,
            error: data.error?.message || 'Failed to fetch user information',
          })
        }
      } catch (error) {
        console.error('Failed to fetch user stores:', error)
        setState({
          user: null,
          stores: [],
          loading: false,
          error: 'Network error: Unable to fetch user information',
        })
      }
    }

    fetchUserStores()
  }, [])

  return state
}
