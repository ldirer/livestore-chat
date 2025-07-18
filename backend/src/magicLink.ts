import { randomUUID } from 'node:crypto'
import * as sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import {FRONTEND_URL} from "./config";

const config = {
  LINK_VALIDITY_MINUTES: 15,
  DB_PATH: './magic-links.db',
}

type MagicLink = {
  id: string
  email: string
  createdAt: Date
  expiresAt: Date
  usedAt: Date | null
}

type RefreshToken = {
  id: string
  userId: string
  createdAt: Date
  expiresAt: Date
  revokedAt: Date | null
}

interface MagicLinkStore {
  createMagicLink: (email: string) => Promise<MagicLink>
  getMagicLink: (token: string) => Promise<MagicLink | undefined>
  markMagicLinkAsUsed: (token: string) => Promise<void> // possibly could be combined with "getMagicLink" into a single operation
  
  // Refresh token methods
  storeRefreshToken: (tokenId: string, userId: string, expiresAt: Date) => Promise<void>
  getRefreshToken: (tokenId: string) => Promise<RefreshToken | undefined>
  revokeRefreshToken: (tokenId: string) => Promise<void>
  revokeAllUserRefreshTokens: (userId: string) => Promise<void>
}

class SQLiteMagicLinkStore implements MagicLinkStore {
  private db!: Database

  constructor() {
    // Constructor will be async initialized via init() method
  }

  async init() {
    this.db = await open({
      filename: config.DB_PATH,
      driver: sqlite3.Database
    })

    // Create magic links table if it does not exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS magic_links (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL
      )
    `)

    // Create refresh tokens table if it does not exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `)
  }

  getMagicLink = async (token: string): Promise<MagicLink | undefined> => {
    const row = await this.db.get(
      'SELECT id, email, created_at, expires_at, used_at FROM magic_links WHERE id = ?',
      token
    )
    
    if (!row) return undefined
    
    return {
      id: row.id,
      email: row.email,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ? new Date(row.used_at) : null
    }
  }
  markMagicLinkAsUsed = async (token: string): Promise<void> => {
    await this.db.run(
      'UPDATE magic_links SET used_at = ? WHERE id = ?',
      new Date().toISOString(),
      token
    )
  }

  createMagicLink = async (email: string): Promise<MagicLink> => {
    const id = randomUUID()
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + config.LINK_VALIDITY_MINUTES * 60 * 1000)
    
    const link: MagicLink = {
      id,
      email,
      createdAt,
      expiresAt,
      usedAt: null,
    }
    
    await this.db.run(
      'INSERT INTO magic_links (id, email, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)',
      id,
      email,
      createdAt.toISOString(),
      expiresAt.toISOString(),
      null
    )
    
    return link
  }

  storeRefreshToken = async (tokenId: string, userId: string, expiresAt: Date): Promise<void> => {
    const createdAt = new Date()
    
    await this.db.run(
      'INSERT INTO refresh_tokens (id, user_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?)',
      tokenId,
      userId,
      createdAt.toISOString(),
      expiresAt.toISOString(),
      null
    )
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
}

type MagicLinkValidation =
  | {
      status: 'valid'
      email: string
    }
  | {
      status: 'invalid'
      reason: 'expired'
    }
  | {
      status: 'invalid'
      reason: 'already_used'
    }
  | {
  status: 'invalid'
  reason: 'token_not_found'
}

type URLString = `http://${string}` | `https://${string}`
export interface MagicLinkService {
  validateMagicToken: (token: string) => Promise<MagicLinkValidation>
  createMagicLink: (email: string) => Promise<URLString>
  
  // Refresh token methods
  storeRefreshToken: (tokenId: string, userId: string, expiresAt: Date) => Promise<void>
  getRefreshToken: (tokenId: string) => Promise<RefreshToken | undefined>
  revokeRefreshToken: (tokenId: string) => Promise<void>
  revokeAllUserRefreshTokens: (userId: string) => Promise<void>
}

export { SQLiteMagicLinkStore }

export async function createMagicLinkStore(): Promise<SQLiteMagicLinkStore> {
  const store = new SQLiteMagicLinkStore()
  await store.init()
  return store
}

export class DefaultMagicLinkService implements MagicLinkService {
  constructor(private db: MagicLinkStore) {}

  validateMagicToken = async (token: string): Promise<MagicLinkValidation> => {
    const link = await this.db.getMagicLink(token)
    
    if (!link) {
      return { status: 'invalid', reason: 'token_not_found' }
    }
    
    if (link.usedAt) {
      return { status: 'invalid', reason: 'already_used' }
    }
    
    if (new Date() > link.expiresAt) {
      return { status: 'invalid', reason: 'expired' }
    }
    
    // Mark as used
    await this.db.markMagicLinkAsUsed(token)
    
    return { status: 'valid', email: link.email }
  }

  createMagicLink = async (email: string): Promise<URLString> => {
    const link = await this.db.createMagicLink(email)
    return `${FRONTEND_URL}/login?token=${link.id}`
  }

  // Refresh token methods
  storeRefreshToken = async (tokenId: string, userId: string, expiresAt: Date): Promise<void> => {
    await this.db.storeRefreshToken(tokenId, userId, expiresAt)
  }

  getRefreshToken = async (tokenId: string): Promise<RefreshToken | undefined> => {
    return await this.db.getRefreshToken(tokenId)
  }

  revokeRefreshToken = async (tokenId: string): Promise<void> => {
    await this.db.revokeRefreshToken(tokenId)
  }

  revokeAllUserRefreshTokens = async (userId: string): Promise<void> => {
    await this.db.revokeAllUserRefreshTokens(userId)
  }
}
