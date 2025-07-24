import { makeAdapter } from '@livestore/adapter-node'
import { createStorePromise } from '@livestore/livestore'
import { makeCfSync } from '@livestore/sync-cf'
import { schema as userSchema } from './schema/user.ts'
import {SYNC_URL} from "./config.ts";

const adapter = makeAdapter({
  storage: { type: 'fs', baseDirectory: '.server-livestore-adapter' },
  sync: {
    backend: makeCfSync({ url: SYNC_URL }),
    onSyncError: 'shutdown',
  },
})

export async function createUserAggregateStore() {
  const store = await createStorePromise({
    schema: userSchema,
    adapter,
    storeId: 'serveronly',
    syncPayload: { authToken: 'servertoken' },
    onBootStatus(status) {
      console.log(`User aggregate store boot stage: ${status.stage}`)
    },
  })
  console.dir(store)
  return store
}


export async function createUserStore(userId: string) {
  const store = await createStorePromise({
    schema: userSchema,
    adapter,
    storeId: `user_${userId}`,
    syncPayload: { authToken: 'servertoken' },
    onBootStatus(status) {
      console.log(`User store boot stage: ${status.stage}`)
    },
  })
  return store
}