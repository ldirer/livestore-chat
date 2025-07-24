import type { MagicLinkService } from './magicLink.ts'
import type { tables as userTables } from './schema/user.ts'
import { sign, verify } from 'hono/jwt'
import { randomUUID } from 'node:crypto'
import * as sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

type UserType = typeof userTables.user.Type

export const JWT_CONFIG = {
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'your-access-token-secret-key',
  LIVESTORE_TOKEN_SECRET: process.env.LIVESTORE_TOKEN_SECRET || 'your-livestore-token-secret-key',
  ACCESS_TOKEN_EXPIRES_IN_SECONDS: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN_EXPIRES_IN_SECONDS: 7 * 24 * 60 * 60, // 7 days in seconds
}

export interface AccessTokenPayload {
  sub: string // user ID
  stores: string[]
  iat: number
  exp: number
  [key: string]: any
}

export interface LivestoreTokenPayload {
  sub: string // user ID
  stores: string[]
  iat: number
  exp: number
  [key: string]: any
}

type RefreshToken = {
  id: string
  userId: string
  createdAt: Date
  expiresAt: Date
  revokedAt: Date | null
}

interface AuthTokenStore {
  createRefreshToken: (userId: string) => Promise<string>
  getRefreshToken: (tokenId: string) => Promise<RefreshToken | undefined>
  revokeRefreshToken: (tokenId: string) => Promise<void>
  revokeAllUserRefreshTokens: (userId: string) => Promise<void>
  rotateRefreshToken: (oldTokenId: string, userId: string) => Promise<string>
}

class SQLiteAuthTokenStore implements AuthTokenStore {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  async init() {
    // Create refresh tokens table if it does not exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL
      )
    `)
  }

  createRefreshToken = async (userId: string): Promise<string> => {
    const tokenId = randomUUID()
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + JWT_CONFIG.REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000)
    
    await this.db.run(
      'INSERT INTO refresh_tokens (id, user_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?)',
      tokenId,
      userId,
      createdAt.toISOString(),
      expiresAt.toISOString(),
      null
    )
    
    return tokenId
  }

  getRefreshToken = async (tokenId: string): Promise<RefreshToken | undefined> => {
    const row = await this.db.get(
      'SELECT id, user_id, created_at, expires_at, revoked_at FROM refresh_tokens WHERE id = ?',
      tokenId
    )
    
    if (!row) return undefined
    
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null
    }
  }

  revokeRefreshToken = async (tokenId: string): Promise<void> => {
    await this.db.run(
      'UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?',
      new Date().toISOString(),
      tokenId
    )
  }

  revokeAllUserRefreshTokens = async (userId: string): Promise<void> => {
    await this.db.run(
      'UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
      new Date().toISOString(),
      userId
    )
  }

  rotateRefreshToken = async (oldTokenId: string, userId: string): Promise<string> => {
    // we could use an atomic transaction here: revoke old token and create a new one.
    // but I don't really know how to do that cleanly with one sqlite connection.
    // if we BEGIN and then await something, concurrent requests could run queries. Not good!
    // I don't really see how to do it without some sort of Mutex...
      await this.revokeRefreshToken(oldTokenId)
      const newTokenId = await this.createRefreshToken(userId)
      return newTokenId
  }
}
export type RefreshTokenValidationError = 'token_not_found' | 'token_expired' | 'token_revoked'
export type RefreshTokenValidationResult = 
  | { success: true; accessToken: string; refreshToken: string; livestoreToken: string }
  | { success: false; error: RefreshTokenValidationError }

export interface AuthService {
  generateTokens: (user: UserType, stores: string[]) => Promise<{ accessToken: string; refreshToken: string; livestoreToken: string }>
  validateAccessToken: (token: string) => Promise<AccessTokenPayload | null>
  refreshTokens: (refreshToken: string) => Promise<RefreshTokenValidationResult>
  logout: (refreshToken: string) => Promise<void>
}

export async function createAuthTokenStore(db: Database): Promise<SQLiteAuthTokenStore> {
  const store = new SQLiteAuthTokenStore(db)
  await store.init()
  return store
}

export class DefaultAuthService implements AuthService {
  constructor(private tokenStore: AuthTokenStore) {}

  generateTokens = async (user: UserType, stores: string[]): Promise<{ accessToken: string; refreshToken: string; livestoreToken: string }> => {
    const now = Math.floor(Date.now() / 1000)

    // Generate access token with user stores
    const accessTokenPayload: AccessTokenPayload = {
      sub: user.id,
      stores,
      iat: now,
      exp: now + JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    }

    const accessToken = await sign(accessTokenPayload, JWT_CONFIG.ACCESS_TOKEN_SECRET)
    
    // Generate livestore token with user stores
    const livestoreTokenPayload: LivestoreTokenPayload = {
      sub: user.id,
      stores,
      iat: now,
      exp: now + JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    }

    const livestoreToken = await sign(livestoreTokenPayload, JWT_CONFIG.LIVESTORE_TOKEN_SECRET)
    
    // Generate opaque refresh token
    const refreshToken = await this.tokenStore.createRefreshToken(user.id)

    return {
      accessToken,
      refreshToken,
      livestoreToken,
    }
  }

  validateAccessToken = async (token: string): Promise<AccessTokenPayload | null> => {
    try {
      const payload = await verify(token, JWT_CONFIG.ACCESS_TOKEN_SECRET)
      return payload as unknown as AccessTokenPayload
    } catch (error) {
      return null
    }
  }

  refreshTokens = async (refreshToken: string): Promise<RefreshTokenValidationResult> => {
    // Check if refresh token exists in database
    const storedToken = await this.tokenStore.getRefreshToken(refreshToken)
    if (!storedToken) {
      return { success: false, error: 'token_not_found' }
    }

    if (storedToken.revokedAt) {
      return { success: false, error: 'token_revoked' }
    }

    if (new Date() > storedToken.expiresAt) {
      return { success: false, error: 'token_expired' }
    }

    // Generate new tokens for the user
    const now = Math.floor(Date.now() / 1000)
    const stores = [`user_${storedToken.userId}`] // Default user store, will be enhanced later
    
    const accessTokenPayload: AccessTokenPayload = {
      sub: storedToken.userId,
      stores,
      iat: now,
      exp: now + JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    }

    const accessToken = await sign(accessTokenPayload, JWT_CONFIG.ACCESS_TOKEN_SECRET)
    
    // Generate livestore token with user stores
    const livestoreTokenPayload: LivestoreTokenPayload = {
      sub: storedToken.userId,
      stores,
      iat: now,
      exp: now + JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    }

    const livestoreToken = await sign(livestoreTokenPayload, JWT_CONFIG.LIVESTORE_TOKEN_SECRET)
    
    // Atomically revoke old token and create new one
    const newRefreshToken = await this.tokenStore.rotateRefreshToken(refreshToken, storedToken.userId)

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      livestoreToken,
    }
  }

  logout = async (refreshToken: string): Promise<void> => {
    if (refreshToken) {
      await this.tokenStore.revokeRefreshToken(refreshToken)
    }
  }
}

export async function sendLoginLink(
  magicLinks: MagicLinkService,
  user: UserType,
) {
  const loginUrl = await magicLinks.createMagicLink(user.email)

  const emailContent = `Click this link to log in: ${loginUrl}`

  try {
    await sendEmail(emailContent, user.email)
  } catch (error) {
    console.error('Failed to send login link:', error)
    throw new Error('EmailCouldNotBeSent')
  }
}

// stub function, not implemented for now.
async function sendEmail(content: string, email: string) {
  // logging the email to stdout (before sending it) so we can click the link in development.
  console.log(`sending email to ${email}: ${content}`)
}
