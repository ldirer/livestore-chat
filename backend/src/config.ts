export const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:60001').replace(
  /\/+$/,
  '',
) as `http://${string}`
export const SYNC_URL = (process.env.SYNC_URL || 'ws://localhost:8787')


export const RESEND_API_KEY = process.env.RESEND_API_KEY
if (RESEND_API_KEY === undefined) {
  console.warn("missing RESEND_API_KEY, will not send emails")
}
