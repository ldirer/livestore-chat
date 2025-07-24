export const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:60001').replace(
  /\/+$/,
  '',
) as `http://${string}`
export const SYNC_URL = (process.env.SYNC_URL || 'ws://localhost:8787')
