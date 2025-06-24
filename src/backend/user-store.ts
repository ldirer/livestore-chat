import { makeAdapter } from '@livestore/adapter-node'
import { createStorePromise } from '@livestore/livestore'
import { makeCfSync } from '@livestore/sync-cf'
import { schema as userSchema } from './schema/user.ts'

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

export async function createUserStore() {
  const store = await createStorePromise({
    schema: userSchema,
    adapter,
    storeId: 'serveronly',
    syncPayload: { authToken: 'servertoken' },
    onBootStatus(status) {
      console.log(`User store boot stage: ${status.stage}`)
    },
  })
  console.dir(store)
  return store
}
