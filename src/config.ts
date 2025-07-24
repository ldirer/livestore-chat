export const LIVESTORE_SYNC_URL = import.meta.env.VITE_LIVESTORE_SYNC_URL
export const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL.replace(
  /\/+$/,
  '',
)

console.log('LIVESTORE_SYNC_URL', LIVESTORE_SYNC_URL)
console.log('SERVER_BASE_URL', SERVER_BASE_URL)
