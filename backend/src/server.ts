import {serve} from '@hono/node-server'
import type {Store} from '@livestore/livestore'
import {queryDb} from '@livestore/livestore'
import {Hono} from 'hono'
import {sendLoginLink, generateTokens, validateAccessToken, validateRefreshToken} from './auth'
import type {MagicLinkService} from './magicLink.ts'
import {createMagicLinkStore, DefaultMagicLinkService} from './magicLink'
import type {schema as testSchema} from './schema/test'
import {tables as testTables} from './schema/test'
import type {schema as userSchema} from './schema/user'
import {events as userEvents, tables as userTables} from './schema/user'
import {randomUUID} from "node:crypto";
import {createUserStore} from "./user-store";
import { setCookie, getCookie } from 'hono/cookie';

type TestStoreType = Store<typeof testSchema>
type UserStoreType = Store<typeof userSchema>

interface AppBindings {
  store: UserStoreType
  magicLinks: MagicLinkService
}

interface AppVariables {
  user: any
  magicLinks: MagicLinkService
}


// Stub function to create a new user
async function createUser(email: string): typeof userTables.user.Type {
  const newUser = {
    id: randomUUID(),
    username: email.split('@')[0],  // Simple username from email
    email,
    createdAt: new Date(),
  }

  const userStore = await createUserStore(newUser.id)
  userStore.commit(userEvents.userProfileCreated(newUser))

  return newUser
}

// JWT Authentication middleware
const jwtAuth = async (c: any, next: any) => {
  const accessToken = getCookie(c, 'accessToken')
  
  if (!accessToken) {
    return c.json(
      {
        error: {
          code: 'ACCESS_TOKEN_MISSING',
          message: 'Access token not found',
        },
      },
      401,
    )
  }

  const payload = await validateAccessToken(accessToken)
  if (!payload) {
    return c.json(
      {
        error: {
          code: 'ACCESS_TOKEN_INVALID',
          message: 'Invalid access token',
        },
      },
      401,
    )
  }

  // Add user payload to context
  c.set('user', payload)
  await next()
}

export function createServer(
  userStore: UserStoreType,
  testStore: TestStoreType,
  magicLinks: MagicLinkService,
) {
  const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()
  
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
        user = await createUser(trimmedEmail)
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

      // Get user by email
      const users = userStore.query(
        queryDb(userTables.user.where({ email: validation.email })),
      )
      const user = users[0] as typeof userTables.user.Type

      if (!user) {
        return c.json(
          {
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            },
          },
          404,
        )
      }

      // Generate JWT tokens
      const tokens = await generateTokens(user)

      // Store refresh token in database
      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      await magicLinks.storeRefreshToken(tokens.refreshTokenId, user.id, refreshTokenExpiry)

      // Set HTTP-only cookies
      setCookie(c, 'accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 15 * 60, // 15 minutes
      })

      setCookie(c, 'refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      })

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

  // POST /auth/refresh endpoint
  app.post('/auth/refresh', async (c) => {
    try {
      const refreshToken = getCookie(c, 'refreshToken')

      if (!refreshToken) {
        return c.json(
          {
            error: {
              code: 'REFRESH_TOKEN_MISSING',
              message: 'Refresh token not found',
            },
          },
          401,
        )
      }

      // Validate refresh token JWT
      const payload = await validateRefreshToken(refreshToken)
      if (!payload) {
        return c.json(
          {
            error: {
              code: 'REFRESH_TOKEN_INVALID',
              message: 'Invalid refresh token',
            },
          },
          401,
        )
      }

      // Check if refresh token exists in database and is not revoked
      const storedToken = await magicLinks.getRefreshToken(payload.tokenId)
      if (!storedToken || storedToken.revokedAt || new Date() > storedToken.expiresAt) {
        return c.json(
          {
            error: {
              code: 'REFRESH_TOKEN_REVOKED',
              message: 'Refresh token has been revoked or expired',
            },
          },
          401,
        )
      }

      // Get user
      const users = userStore.query(
        queryDb(userTables.user.where({ id: payload.sub })),
      )
      const user = users[0] as typeof userTables.user.Type

      if (!user) {
        return c.json(
          {
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            },
          },
          404,
        )
      }

      // Revoke old refresh token
      await magicLinks.revokeRefreshToken(payload.tokenId)

      // Generate new tokens
      const tokens = await generateTokens(user)

      // Store new refresh token in database
      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      await magicLinks.storeRefreshToken(tokens.refreshTokenId, user.id, refreshTokenExpiry)

      // Set new HTTP-only cookies
      setCookie(c, 'accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 15 * 60, // 15 minutes
      })

      setCookie(c, 'refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      })

      return c.json({
        success: true,
        message: 'Tokens refreshed successfully',
      })
    } catch (error) {
      console.error('Refresh token error:', error)
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

  // POST /auth/logout endpoint
  app.post('/auth/logout', async (c) => {
    try {
      const refreshToken = getCookie(c, 'refreshToken')

      if (refreshToken) {
        // Try to revoke the refresh token from database
        const payload = await validateRefreshToken(refreshToken)
        if (payload) {
          await magicLinks.revokeRefreshToken(payload.tokenId)
        }
      }

      // Clear both cookies
      setCookie(c, 'accessToken', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 0, // Expire immediately
      })

      setCookie(c, 'refreshToken', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 0, // Expire immediately
      })

      return c.json({
        success: true,
        message: 'Logged out successfully',
      })
    } catch (error) {
      console.error('Logout error:', error)
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
  app.get('/auth/me', jwtAuth, async (c) => {
    try {
      const userPayload = c.get('user')
      
      // Get user from database
      const users = userStore.query(
        queryDb(userTables.user.where({ id: userPayload.sub })),
      )
      const user = users[0] as typeof userTables.user.Type | undefined

      if (!user) {
        return c.json(
          {
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            },
          },
          404,
        )
      }

      return c.json({
        success: true,
        user,
        stores: userPayload.stores,
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
