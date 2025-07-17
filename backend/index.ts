import { startServer } from './server'
import { createTestStore } from './test-store'
import { createUserStore } from './user-store'

async function main() {
  console.log('Initializing server...')

  const userStore = await createUserStore()
  const testStore = await createTestStore()
  // const userStore = undefined
  // const testStore = undefined

  // Start the server with both stores
  // The onBootStatus should trigger when the stores are actually used
  startServer(userStore, testStore, 9003)
}

main()
