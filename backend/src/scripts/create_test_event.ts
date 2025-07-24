import { randomUUID } from 'node:crypto'
import { makeAdapter } from '@livestore/adapter-node'
import { createStorePromise, queryDb } from '@livestore/livestore'
import { makeCfSync } from '@livestore/sync-cf'
import { events, schema, tables as testTables } from '../schema/test'

const adapter = makeAdapter({
  // can't use shared storage with the server process - this would result in both processes trying to use the same database.
  // I ran into sqlite Disk I/O errors that I attribute to that.
  storage: { type: 'in-memory' },
  sync: {
    backend: makeCfSync({ url: 'ws://localhost:8787' }),
    onSyncError: 'shutdown',
  },
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function main() {
  const store = await createStorePromise({
    schema,
    adapter,
    storeId: 'test-store',
    syncPayload: { authToken: 'servertoken' },
    onBootStatus(status) {
      console.log(`Test store boot stage: ${status.stage}`)
    },
  })

  // There's an issue querying before store ready here...
  // I think 'store ready' can be defined as: the first pull is complete and materialized.
  await sleep(1000)
  const id = randomUUID()
  const eventData = { id, message: `hello ${id}` }
  const results = store.query(queryDb(testTables.test))
  console.log('READING results', results)
  store.commit(events.testEvent(eventData))
  console.log('committed test event:', eventData)

  // wait for syncing. copied from node-adapter example in livestore repo.
  await new Promise((resolve) => setTimeout(resolve, 1000))
  store.shutdown()
}

await main()
