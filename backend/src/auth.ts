import type { MagicLinkService } from './magicLink.ts'
import type { tables as userTables } from './schema/user.ts'
import { sign, verify } from 'hono/jwt'
import { randomUUID } from 'node:crypto'

type UserType = typeof userTables.user.Type

const JWT_CONFIG = {
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'your-access-token-secret-key',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-token-secret-key',
  ACCESS_TOKEN_EXPIRES_IN: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60, // 7 days in seconds
}

export interface AccessTokenPayload {
  sub: string // user ID
  email: string
  stores: Array<{ type: string; id: string }>
  iat: number
  exp: number
  [key: string]: any
}

export interface RefreshTokenPayload {
  sub: string // user ID
  tokenId: string // unique token ID for revocation
  iat: number
  exp: number
  [key: string]: any
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  refreshTokenId: string
}

export async function generateTokens(user: UserType): Promise<TokenPair> {
  const now = Math.floor(Date.now() / 1000)
  const refreshTokenId = randomUUID()

  // Generate access token with user stores
  const accessTokenPayload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    stores: [
      { type: 'user', id: `user_store_${user.id}` },
      // Add other stores based on user permissions
    ],
    iat: now,
    exp: now + JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
  }

  // Generate refresh token
  const refreshTokenPayload: RefreshTokenPayload = {
    sub: user.id,
    tokenId: refreshTokenId,
    iat: now,
    exp: now + JWT_CONFIG.REFRESH_TOKEN_EXPIRES_IN,
  }

  const accessToken = await sign(accessTokenPayload, JWT_CONFIG.ACCESS_TOKEN_SECRET)
  const refreshToken = await sign(refreshTokenPayload, JWT_CONFIG.REFRESH_TOKEN_SECRET)

  return {
    accessToken,
    refreshToken,
    refreshTokenId,
  }
}

export async function validateAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const payload = await verify(token, JWT_CONFIG.ACCESS_TOKEN_SECRET)
    return payload as unknown as AccessTokenPayload
  } catch (error) {
    return null
  }
}

export async function validateRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const payload = await verify(token, JWT_CONFIG.REFRESH_TOKEN_SECRET)
    return payload as unknown as RefreshTokenPayload
  } catch (error) {
    return null
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
