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

  // POST /signup endpoint
  // if the email is already attached to _another_ user, this should behave as a login endpoint, except in the store
  // emitting the event it may look like the email did get attached.
  // I guess that's a bug? Accepting that, there are few legitimate cases.
  app.post('/signup', async (c) => {
    try {
      const body = await c.req.json()
      const { email, privateId } = body

      if (!email || !privateId) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Missing required fields: email, privateId',
            },
          },
          400,
        )
      }

      // Look up user by privateId
      const users = userStore.query(
        queryDb(userTables.user.where({ privateId })),
      )
      const user = users[0]

      if (!user) {
        return c.json(
          {
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found with provided privateId',
            },
          },
          400,
        )
      }

      // Check if email is already set
      if (user.email && user.email.trim() !== '') {
        return c.json(
          {
            error: {
              code: 'EMAIL_ALREADY_SET',
              message: 'Email is already set for this user',
            },
          },
          400,
        )
      }

      // Update email by committing an event. This should be a backend-only event. There are ways to authenticate that I guess.
      sendEventToUserSpecificStore(
        privateId,
        userEvents.userEmailAttached({
          privateId,
          username: user.username,
          email: email.trim(),
        }),
      )

      await sendLoginLink(magicLinks, user)

      return c.json({
        success: true,
        message: 'Email updated successfully',
      })
    } catch (error) {
      console.error('Signup error:', error)
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

  // POST /login endpoint
  app.post('/login', async (c) => {
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

      // Look up user by email
      const users = userStore.query(
        queryDb(userTables.user.where({ email: email.trim() })),
      )
      const user = users[0] as typeof userTables.user.Type | undefined

      if (!user) {
        // This is bad practice as it can leak emails used on the platform,
        // but we favor debuggability right now
        return c.json(
          {
            error: {
              code: 'EMAIL_NOT_FOUND',
              message: 'Email not found in our system',
            },
          },
          400,
        )
      }

      // Send magic link
      await sendLoginLink(magicLinks, user)

      return c.json({
        success: true,
        message: 'Magic link sent successfully',
      })
    } catch (error) {
      console.error('Login error:', error)
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
