import { makeAdapter } from '@livestore/adapter-node'
import { createStorePromise } from '@livestore/livestore'
import { makeCfSync } from '@livestore/sync-cf'
import { schema } from './schema/test.ts'
import {SYNC_URL} from "./config.ts";

const adapter = makeAdapter({
  storage: { type: 'fs', baseDirectory: '.server-livestore-adapter' },
  sync: {
    backend: makeCfSync({ url: SYNC_URL }),
    onSyncError: 'shutdown',
  },
})

export async function createTestStore() {
  const testStore = await createStorePromise({
    schema,
    adapter,
    storeId: 'test-store',
    syncPayload: { authToken: 'servertoken' },
    onBootStatus(status) {
      console.log(`Test store boot stage: ${status.stage}`)
    },
  })
  return testStore
}
