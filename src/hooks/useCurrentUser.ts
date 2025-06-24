import { queryDb } from '@livestore/livestore'
import { useStore } from '@livestore/react'
import { useEffect } from 'react'
import { events, tables } from '../livestore/schema.js'
import { useURLParams } from './useURLParams'

function randomUserName() {
  return `user_${Math.floor(Math.random() * 100000)}`
}

/**
 * Hook to get or create the current user
 * Gets username from URL query params, or generates a random one if not present
 * Eventually this should be replaced by proper authentication
 */
export const useCurrentUser = ():
  | typeof tables.userProfile.Type
  | undefined => {
  console.log('useCurrentUser', useCurrentUser)
  const { store } = useStore()

  // Get username from URL query params using the reactive hook
  const params = useURLParams()
  const usernameFromParams = params.username
  console.log('params.username', params.username)

  const username = usernameFromParams || randomUserName()

  // Look up user in database
  const users = store.useQuery(
    queryDb(
      tables.userProfile.where({
        username,
      }),
    ),
  )

  useEffect(() => {
    if (!usernameFromParams) {
      // will trigger a re-execution of this hook (URL as single source of truth)
      const url = new URL(window.location.href)
      url.searchParams.set('username', username)
      window.history.replaceState({}, '', url)
      return
    }
    // If user doesn't exist, create it
    if (users.length === 0) {
      const userId = crypto.randomUUID()
      console.log('CREATING NEW USER', userId, username)
      store.commit(
        events.userProfileCreated({
          id: userId,
          username,
          createdAt: new Date(),
        }),
      )
    }
  }, [usernameFromParams])

  return users[0]
}
