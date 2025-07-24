import { startServer } from './server'
import { createTestStore } from './test-store'
import { createUserAggregateStore } from './user-store'


async function main() {
  console.log('Initializing server...')
  
  const { port, hostname } = parseArgs()
  console.log(`Server will start on ${hostname}:${port}`)

  const userStore = await createUserAggregateStore()
  const testStore = await createTestStore()
  // const userStore = undefined
  // const testStore = undefined

  // Start the server with both stores
  // The onBootStatus should trigger when the stores are actually used
  await startServer(userStore, testStore, port, hostname)
}
// ai-generated
function parseArgs() {
  const args = process.argv.slice(2)
  let port = 9003
  let hostname = '0.0.0.0'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if ((arg === '--port' || arg === '-p') && i + 1 < args.length) {
      const portStr = args[i + 1]
      if (portStr) {
        const portValue = parseInt(portStr, 10)
        if (!isNaN(portValue) && portValue > 0 && portValue <= 65535) {
          port = portValue
          i++ // Skip next argument since we consumed it
        } else {
          console.error(`Invalid port: ${portStr}`)
          process.exit(1)
        }
      }
    } else if ((arg === '--host' || arg === '-h') && i + 1 < args.length) {
      const hostnameArg = args[i + 1]
      if (hostnameArg) {
        hostname = hostnameArg
        i++ // Skip next argument since we consumed it
      }
    } else if (arg === '--help') {
      console.log('Usage: node index.js [options]')
      console.log('Options:')
      console.log('  --port, -p <port>      Port to listen on (default: 9003)')
      console.log('  --host, -h <address>   Address to bind to (default: 0.0.0.0)')
      console.log('  --help                 Show this help message')
      process.exit(0)
    }
  }

  const configuration = { port, hostname}
  console.log('using configuration', configuration )

  return configuration
}




main()
