import { makeAdapter } from '@livestore/adapter-node'
import { createStorePromise } from '@livestore/livestore'
import { makeCfSync } from '@livestore/sync-cf'
import { schema } from './schema/test.ts'

const adapter = makeAdapter({
  storage: { type: 'fs', baseDirectory: '.server-livestore-adapter' },
  // or in-memory:
  // storage: { type: 'in-memory' },
  sync: {
    backend: makeCfSync({ url: 'ws://localhost:8787' }),
    onSyncError: 'shutdown',
  },
  // To enable devtools:
  // devtools: { schemaPath: new URL('./schema.ts', import.meta.url) },
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
