import { makePersistedAdapter } from '@livestore/adapter-web'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { queryDb } from '@livestore/livestore'
import { LiveStoreProvider, useStore } from '@livestore/react'
import { FPSMeter } from '@overengineering/fps-meter'
import type React from 'react'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'
import EmailLoginPage from './components/EmailLoginPage.js'
import { MainSection } from './components/MainSection.js'
import { useCurrentUserStores } from './hooks/useCurrentUserStores.ts'
// import { schema } from './livestore/workspace-schema.ts'
import { tables, schema as userSchema } from './livestore/user-schema.ts'
import UserLiveStoreWorker from './livestore.worker?worker'

const AppBody: React.FC = () => {
  const { store } = useStore()
  const users = store.useQuery(queryDb(tables.userProfile))
  // const states = store._dev.syncStates()

  // console.dir(store._dev)
  // console.log('store._dev.syncStates()', store._dev.syncStates.subscribe())

  if (users.length === 0) {
    // wait for the first pull to have completed if we know it comes from an existing store.
    // this works around the 'create default if not present' logic running on a store that has data, just not yet loaded.
    console.log('No users for now, assuming store needs to be loaded...')
    return null
  }
  console.log('users.length', users.length)

  return (
    <section>
      <MainSection />
    </section>
  )
}

// const storeId = getUserStoreId()

// // would-be TODO next: two adapters. Then write a custom provider? Need two stores. Then we commit events in the two stores?
// // no transactional guarantees. We just live with it. AAAAH all my life learnings go against this.
// const workspaceAdapter = makePersistedAdapter({
//   storage: { type: 'opfs' },
//   worker: LiveStoreWorker,
//   sharedWorker: LiveStoreSharedWorker,
//   // resetPersistence: true
// })

const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: UserLiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
  // resetPersistence: true
})

function MainPage() {
  const authState = useCurrentUserStores()
  if (authState.loading) {
    // This might flash... eh.
    return <div>Loading your data...</div>
  }
  if (authState.error !== null) {
    // show email login form "looks like you are not signed in..."
    return <div>Authentication error :o</div>
  }

  const userStoreId = `user_${authState.user.id}`
  return (
    <LiveStoreProvider
      schema={userSchema}
      // disableDevtools={true}
      adapter={adapter}
      renderLoading={(_) => <div>Loading LiveStore ({_.stage})...</div>}
      batchUpdates={batchUpdates}
      storeId={userStoreId}
      syncPayload={{ authToken: 'insecure-token-change-me' }}
    >
      <div
        style={{ top: 0, right: 0, position: 'absolute', background: '#333' }}
      >
        <FPSMeter height={40} />
      </div>
      <AppBody />
    </LiveStoreProvider>
  )
}

export const App: React.FC = () => {
  const currentPath = window.location.pathname

  if (currentPath === '/login') {
    return <EmailLoginPage />
  }
  return <MainPage />
}
