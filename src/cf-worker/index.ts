import { makeDurableObject, makeWorker } from '@livestore/sync-cf/cf-worker'
import { jwtVerify } from 'jose'

const AUTH_SERVER_TOKEN = 'servertoken'
// we can't access this.env in validatePayload.
// The anode codebase has a workaround: it defines a new worker with a fetch method
// inside that, it calls makeWorker with a validatePayload that can use `env` from the closure
// For now I'll just use a global variable.
const LIVESTORE_AUTH_TOKEN_SECRET = 'your-livestore-token-secret-key'

export class WebSocketServer extends makeDurableObject({
  onPush: async (message) => {
    console.log('onPush', message.batch)
  },
  onPull: async (message) => {
    console.log('onPull', message)
  },
}) {}

export default makeWorker({
  // this runs right before establishing the websocket connection.
  // my understanding is after that a malicious user could send anything in the websocket.
  // they would be limited to the relevant store by this ('caveat' comment below), so this should be sufficient security as long as we don't have permissions.
  // biome-ignore lint/suspicious/noExplicitAny: whatever
  validatePayload: async (payload: any) => {
    const authToken = payload?.authToken

    // Check if token exists
    if (!authToken) {
      console.log('JWT validation failed: No auth token provided')
      // @ts-expect-error I think CloudFlare workers support the 'cause' parameter, but it's ES2022
      // and they only support _part_ of it, so we don't want to change the tsconfig? ANYWAY.
      throw new Error('No auth token provided', { cause: { status: 401 } })
    }

    // If it's the servertoken, allow it (for backward compatibility)
    if (authToken === AUTH_SERVER_TOKEN) {
      console.log('JWT validation: Using server token (bypass)')
      return
    }

    // Otherwise, treat it as a JWT
    // caveat: Making the storeId available through the payload: this is NOT secure since it comes
    // from the user and could be made different from the storeId on the request.
    // making it secure would mean getting the "ground truth" storeId from the request.
    // as a proof of concept this is fine (no easy access to the request inside this method at the moment).
    const requestStoreId = payload.storeId
    await validateJWT(authToken, requestStoreId)
  },
  enableCORS: true,
})

// confirm a valid JWT that gives permissions to access the relevant storeId.
async function validateJWT(authToken: string, requestStoreId: string) {
  try {
    // Verify JWT signature and get payload
    const secret = new TextEncoder().encode(LIVESTORE_AUTH_TOKEN_SECRET)
    const { payload: decoded } = await jwtVerify(authToken, secret)

    // Validate that the token has a stores property
    if (!decoded.stores || !Array.isArray(decoded.stores)) {
      console.log('JWT validation failed: Token missing stores array')
      // @ts-expect-error cause arg
      throw new Error('Invalid token: missing stores', {
        cause: { status: 403 },
      })
    }

    // Check if the requested storeId is in the JWT's stores array
    if (!decoded.stores.includes(requestStoreId)) {
      console.log('JWT validation failed: Store access denied')
      console.log('decoded.stores', decoded.stores)
      console.log('requestStoreId', requestStoreId)
      // @ts-expect-error cause arg
      throw new Error('Store access denied', { cause: { status: 403 } })
    }

    console.log('JWT validation successful')
  } catch (error) {
    // Handle JWT parsing/validation errors
    // @ts-ignore
    if (error.cause?.status) {
      // Re-throw our custom errors with status codes
      throw error
    }

    // Handle JWT library errors (signature verification, expiration, etc.)
    console.log('JWT validation failed: Invalid JWT', {
      // @ts-ignore
      error: error.message,
    })
    // @ts-expect-error cause arg
    throw new Error('Invalid JWT token', { cause: { status: 401 } })
  }
}
