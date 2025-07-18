import { startServer } from './server'
import { createTestStore } from './test-store'
import { createUserAggregateStore } from './user-store'

async function main() {
  console.log('Initializing server...')

  const userStore = await createUserAggregateStore()
  const testStore = await createTestStore()
  // const userStore = undefined
  // const testStore = undefined

  // Start the server with both stores
  // The onBootStatus should trigger when the stores are actually used
  await startServer(userStore, testStore, 9003)
}

main()
