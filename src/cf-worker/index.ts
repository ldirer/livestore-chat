import { makeDurableObject, makeWorker } from '@livestore/sync-cf/cf-worker'

export class WebSocketServer extends makeDurableObject({
  onPush: async (message) => {
    console.log('onPush', message.batch)
  },
  onPull: async (message) => {
    console.log('onPull', message)
  },
}) {}

export default makeWorker({
  validatePayload: (payload: any) => {
    if (
      payload?.authToken !== 'insecure-token-change-me' &&
      payload?.authToken !== 'servertoken'
    ) {
      throw new Error('Invalid auth token')
    }
    // the request contains storeId.
    // it is used in @livestore/sync-cf/src/cf-worker/durable-object.ts:69 (makeDurableObject)
    // but we also want the store type, so I think we need this.
    // persist({storeId: payload.storeId, storeType: payload.storeType})
  },
  enableCORS: true,
})
