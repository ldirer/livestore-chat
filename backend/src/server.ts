import {serve} from '@hono/node-server'
import type {Store} from '@livestore/livestore'
import {queryDb} from '@livestore/livestore'
import {Hono} from 'hono'
import {sendLoginLink} from './auth'
import type {MagicLinkService} from './magicLink.ts'
import {createMagicLinkStore, DefaultMagicLinkService} from './magicLink'
import type {schema as testSchema} from './schema/test'
import {tables as testTables} from './schema/test'
import type {schema as userSchema} from './schema/user'
import {events as userEvents, tables as userTables} from './schema/user'

type TestStoreType = Store<typeof testSchema>
type UserStoreType = Store<typeof userSchema>

interface AppBindings {
  store: UserStoreType
  magicLinks: MagicLinkService
}

// can safely be ignored for now
function sendEventToUserSpecificStore(
  event: ReturnType<(typeof userEvents)[keyof typeof userEvents]>,
) {
  console.log('fake sending event', event)
}

// Stub function to create a new user
function createUser(email: string, userStore: UserStoreType): typeof userTables.user.Type {
  const privateId = `user_${Date.now()}_${Math.random().toString(36).substring(2)}`
  const username = email.split('@')[0] // Simple username from email
  
  const newUser = {
    privateId,
    username,
    email,
  }
  
  // This would normally commit to the store, but for now we'll stub it
  sendEventToUserSpecificStore(
    userEvents.userEmailAttached({
      privateId,
      username,
      email,
    })
  )
  
  return newUser
}

export function createServer(
  userStore: UserStoreType,
  testStore: TestStoreType,
  magicLinks: MagicLinkService,
) {
  const app = new Hono<{ Bindings: AppBindings }>()
  
  // Set magic links service in context
  app.use('*', async (c, next) => {
    c.set('magicLinks', magicLinks)
    await next()
  })

  // Health check endpoint
  app.get('/', (c) => {
    const users = userStore.query(queryDb(userTables.user))
    console.log('users', users)

    // userStore.manualRefresh()
    // userStore.commit(userEvents.userEmailAttached({privateId: '123', username: 'user1', email: '<EMAIL>'}))

    return c.text('ok')
  })

  app.get('/test', (c) => {
    const testItems = testStore.query(queryDb(testTables.test))
    console.log('testStore.query(queryDb(testTables.test))', testItems)
    return c.json(testItems)
  })

  // POST /auth/request-magic-link endpoint
  // Unified login/signup flow - creates user if doesn't exist, sends magic link either way
  app.post('/auth/request-magic-link', async (c) => {
    try {
      const body = await c.req.json()
      const { email } = body

      if (!email) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Missing required field: email',
            },
          },
          400,
        )
      }

      const trimmedEmail = email.trim()
      
      // Look up user by email
      const users = userStore.query(
        queryDb(userTables.user.where({ email: trimmedEmail })),
      )
      let user = users[0] as typeof userTables.user.Type | undefined

      // If user doesn't exist, create them
      if (!user) {
        console.log('email not found in database, creating user for', email)
        user = createUser(trimmedEmail, userStore)
      }

      // Send magic link
      await sendLoginLink(magicLinks, user)

      return c.json({
        success: true,
        message: 'Magic link sent successfully',
      })
    } catch (error) {
      console.error('Auth request error:', error)
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
          },
        },
        500,
      )
    }
  })


  // POST /auth/submit-magic-link endpoint
  app.post('/auth/submit-magic-link', async (c) => {
    try {
      const body = await c.req.json()
      const { token } = body

      if (!token) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Missing required field: token',
            },
          },
          400,
        )
      }

      const validation = await magicLinks.validateMagicToken(token)

      if (validation.status === 'invalid') {
        return c.json(
          {
            error: {
              code: validation.reason.toUpperCase(),
            },
          },
          400,
        )
      }

      return c.json({
        success: true,
        email: validation.email,
        message: 'Magic link validated successfully',
      })
    } catch (error) {
      console.error('Magic link validation error:', error)
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
          },
        },
        500,
      )
    }
  })

  // GET /auth/me endpoint
  // Returns current user info and their stores
  app.get('/auth/me', async (c) => {
    try {
      // Stub response - assume authentication is handled elsewhere
      return c.json({
        success: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          username: 'test',
        },
        stores: [
          { type: 'user', id: 'user_store_123' },
          { type: 'workspace', id: 'workspace_abc' },
          { type: 'workspace', id: 'workspace_xyz' },
        ],
      })
    } catch (error) {
      console.error('Auth me error:', error)
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
          },
        },
        500,
      )
    }
  })

  return app
}

export async function startServer(
  userStore?: UserStoreType,
  testStore?: TestStoreType,
  port = 9003,
) {
  // Initialize magic link service
  const magicLinkStore = await createMagicLinkStore()
  const magicLinks = new DefaultMagicLinkService(magicLinkStore)
  
  const app = createServer(
    userStore || ({} as UserStoreType),
    testStore || ({} as TestStoreType),
    magicLinks,
  )

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info: { port: number }) => {
      console.log(`Server listening on http://localhost:${info.port}`)
    },
  )

  return server
}
