import { type UserInfo, useCurrentUserStores } from './useCurrentUserStores.ts'

/**
 * Hook to get just the current user info (convenience wrapper)
 */
export const useCurrentUser = (): UserInfo | null => {
  const { user } = useCurrentUserStores()
  return user
}
