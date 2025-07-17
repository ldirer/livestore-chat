import { queryDb } from '@livestore/livestore'
import { useStore } from '@livestore/react'
import { tables } from '../livestore/user-schema.ts'
import { useURLParams } from './useURLParams'

function randomUserName() {
  return `user_${Math.floor(Math.random() * 100000)}`
}

/**
 * Hook to get or create the current user
 * Gets username from URL query params, or generates a random one if not present
 * Eventually this should be replaced by proper authentication
 */
export const useCurrentUser = (): {
  isLoading: boolean
  user: typeof tables.userProfile.Type | undefined
} => {
  console.log('useCurrentUser', useCurrentUser)
  const { store } = useStore()
  const token = useAuthToken()

  // Look up user in database
  const users = store.useQuery(queryDb(tables.userProfile))
  if (users.length > 0) {
    return { isLoading: false, user: users[0] }
  }

  // no users: we could be loading a store... or we could just have no user
  return { isLoading: hasAuthToken(), user: undefined }
}

const useAuthToken = (): string | undefined => {
  const params = useURLParams()
  return params.authToken
}

type TaggedStoreId = { type: 'user' | 'workspace'; id: string }

// TODO@ldirer
function parseStoreIdsParam(storeIds: string): TaggedStoreId[] {
  return []
}
