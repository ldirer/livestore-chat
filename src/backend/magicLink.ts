import { randomUUID } from 'node:crypto'

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

interface MagicLinkStore {
  createMagicLink: (email: string) => MagicLink
  getMagicLink: (token: string) => MagicLink | undefined
  markMagicLinkAsUsed: (token: string) => void // possibly could be combined with "getMagicLink" into a single operation
}

class SQLiteMagicLinkStore implements MagicLinkStore {
  constructor() {
    // initialize database connection
    // create magic links table if it does not exist
    this.db = {}
  }

  getMagicLink = (token: string): MagicLink | undefined => {
    return this.db.execute('SELECT * FROM magic_links WHERE id = $1', token)
  }
  markMagicLinkAsUsed = (token: string) => {
    this.db.execute(
      'UPDATE magic_links SET used_at = NOW() WHERE id = $1',
      token,
    )
  }

  createMagicLink = (email: string): MagicLink => {
    return {
      id: randomUUID(),
      email,
      createdAt: new Date(),
      expiresAt: new Date(), //  + config.LINK_VALIDITY_MINUTES,   //@CLAUDE make the "+ 15 minutes" work
      usedAt: null,
    }
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

type MagicLinkToken = string
export interface MagicLinkService {
  validateMagicLink: (token: string) => MagicLinkValidation
  createMagicLink: (email: string) => MagicLinkToken
}

export class DefaultMagicLinkService implements MagicLinkService {
  constructor(private db: MagicLinkStore) {}

  validateMagicLink = (token: string): MagicLinkValidation => {
    const link = this.db.getMagicLink(token)
    // ...
  }

  createMagicLink(email: string): MagicLinkToken {}
}
