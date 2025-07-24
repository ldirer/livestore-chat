import {serve} from '@hono/node-server'
import type {Store} from '@livestore/livestore'
import {queryDb} from '@livestore/livestore'
import {Hono} from 'hono'
import {logger} from 'hono/logger'
import {
  sendLoginLink,
  createAuthTokenStore,
  DefaultAuthService,
  type AuthService,
  JWT_CONFIG,
  type RefreshTokenValidationError
} from './auth'
import type {MagicLinkService} from './magicLink.ts'
import {createMagicLinkStore, DefaultMagicLinkService} from './magicLink'
import type {schema as testSchema} from './schema/test'
import {tables as testTables} from './schema/test'
import type {schema as userSchema} from './schema/user'
import {events as userEvents, tables as userTables} from './schema/user'
import {randomUUID} from "node:crypto";
import {createUserStore} from "./user-store";
import { setCookie, getCookie } from 'hono/cookie';
import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import type {AddressInfo} from "node:net";

type TestStoreType = Store<typeof testSchema>
type UserStoreType = Store<typeof userSchema>

interface AppBindings {
  store: UserStoreType
  magicLinks: MagicLinkService
  auth: AuthService
}

interface AuthenticatedUser {
  id: string
  stores: string[]
}

interface AppVariables {
  user: AuthenticatedUser
  auth: AuthService
  magicLinks: MagicLinkService
}


async function createUser(email: string): Promise<typeof userTables.user.Type> {
  const newUser = {
    id: randomUUID(),
    username: email.split('@')[0]!,  // Simple username from email
    email,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const userStore = await createUserStore(newUser.id)
  userStore.commit(userEvents.userProfileCreated(newUser))

  return newUser
}

// JWT Authentication middleware
const jwtAuth = async (c: any, next: any) => {
  const accessToken = getCookie(c, 'accessToken')
  const auth: AuthService = c.get('auth')

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

  const payload = await auth.validateAccessToken(accessToken)
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

  // Transform payload to user object that endpoints can use
  const user: AuthenticatedUser = {
    id: payload.sub,
    stores: payload.stores,
  }
  c.set('user', user)
  await next()
}

export function createServer(
  userStore: UserStoreType,
  testStore: TestStoreType,
  magicLinks: MagicLinkService,
  auth: AuthService,
) {
  const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

  // Global error handler
  app.onError((err, c) => {
    console.error('Server error:', err)
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal server error occurred',
        },
      },
      500
    )
  })

  app.use('*', logger())
  // Set services in context
  app.use('*', async (c, next) => {
    c.set('magicLinks', magicLinks)
    c.set('auth', auth)
    await next()
  })

  // debug helper endpoint
  app.get('/users', (c) => {
    const users = userStore.query(queryDb(userTables.user))
    console.log('users', users)

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
  })


  // POST /auth/submit-magic-link endpoint
  app.post('/auth/submit-magic-link', async (c) => {
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
    const auth: AuthService = c.get('auth')
    const userStores = [`user_${user.id}`] // Default user store, will be enhanced later
    const tokens = await auth.generateTokens(user, userStores)

    // Set HTTP-only cookies
    // We don't want cookies expiring before tokens, so a stale token can be detected as 'your authentication expired'
    setCookie(c, 'accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: Math.floor(JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1.5),
    })

    setCookie(c, 'refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: Math.floor(JWT_CONFIG.REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1.5),
    })

    return c.json({
      success: true,
      email: validation.email,
      message: 'Magic link validated successfully',
      livestoreToken: tokens.livestoreToken,
    })
  })

  // POST /auth/refresh endpoint
  app.post('/auth/refresh', async (c) => {
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

    const auth: AuthService = c.get('auth')
    const result = await auth.refreshTokens(refreshToken)

    if (!result.success) {
      const errorMessages: Record<RefreshTokenValidationError, string> = {
        token_not_found: 'Refresh token not found',
        token_expired: 'Refresh token has expired',
        token_revoked: 'Refresh token has been revoked',
      }

      const errorResult = result
      return c.json(
        {
          error: {
            code: errorResult.error.toUpperCase(),
            message: errorMessages[errorResult.error],
          },
        },
        401,
      )
    }

    // Set new HTTP-only cookies
    // We don't want cookies expiring before tokens, so a stale token can be detected as 'your authentication expired'
    setCookie(c, 'accessToken', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: Math.floor(JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1.5),
    })

    setCookie(c, 'refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: Math.floor(JWT_CONFIG.REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1.5),
    })

    return c.json({
      success: true,
      message: 'Tokens refreshed successfully',
      livestoreToken: result.livestoreToken,
    })
  })

  // POST /auth/logout endpoint
  app.post('/auth/logout', async (c) => {
    const refreshToken = getCookie(c, 'refreshToken')
    const auth: AuthService = c.get('auth')

    if (refreshToken) {
      await auth.logout(refreshToken)
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
  })

  // GET /auth/me endpoint
  // Returns current user info and their stores
  app.get('/auth/me', jwtAuth, async (c) => {
    const authenticatedUser: AuthenticatedUser = c.get('user')

    // Get user from database
    const users = userStore.query(
      queryDb(userTables.user.where({ id: authenticatedUser.id })),
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
      stores: authenticatedUser.stores,
    })
  })

  return app
}

// Create centralized database initialization
async function initializeDatabase(): Promise<Database> {
  const dbPath = process.env.DATABASE_PATH
  if (!dbPath) {
    throw new Error('DATABASE_PATH environment variable required')
  }
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })
  return db
}


export async function startServer(
  userStore?: UserStoreType,
  testStore?: TestStoreType,
  port = 9003,
) {
  // Initialize centralized database
  const db = await initializeDatabase()

  // Initialize magic link service
  const magicLinkStore = await createMagicLinkStore(db)
  const magicLinks = new DefaultMagicLinkService(magicLinkStore)

  // Initialize auth service
  const authTokenStore = await createAuthTokenStore(db)
  const auth = new DefaultAuthService(authTokenStore)

  const app = createServer(
    userStore || ({} as UserStoreType),
    testStore || ({} as TestStoreType),
    magicLinks,
    auth,
  )

  const server = serve(
    {
      fetch: app.fetch,
      port,
      hostname: "0.0.0.0",
    },
    (info: AddressInfo) => {
      console.log(`Server listening on http://${info.address}:${info.port}`)
    },
  )

  return server
}

