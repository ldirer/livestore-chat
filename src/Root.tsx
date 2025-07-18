import { makePersistedAdapter } from '@livestore/adapter-web'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { queryDb } from '@livestore/livestore'
import { LiveStoreProvider, useStore } from '@livestore/react'
import { FPSMeter } from '@overengineering/fps-meter'
import type React from 'react'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'
import { AuthGuard, useAuthenticatedUserInfo } from './components/AuthGuard.tsx'
import EmailLoginPage from './components/EmailLoginPage.js'
import { MainSection } from './components/MainSection.js'
import { tables, schema as userSchema } from './livestore/user-schema.ts'
import UserLiveStoreWorker from './livestore.worker?worker'

const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: UserLiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
  // resetPersistence: true
})

function MainPage() {
  const { user, livestoreToken } = useAuthenticatedUserInfo()
  const userStoreId = `user_${user.id}`
  return (
    <LiveStoreProvider
      schema={userSchema}
      // disableDevtools={true}
      adapter={adapter}
      renderLoading={(_) => <div>Loading LiveStore ({_.stage})...</div>}
      batchUpdates={batchUpdates}
      storeId={userStoreId}
      syncPayload={{ authToken: livestoreToken }}
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
  // quick hack, routing like this only works on first render.
  const currentPath = window.location.pathname

  if (currentPath === '/login') {
    return <EmailLoginPage />
  }
  return (
    <AuthGuard>
      <MainPage />
    </AuthGuard>
  )
}

const AppBody: React.FC = () => {
  const { store } = useStore()
  const users = store.useQuery(queryDb(tables.userProfile))
  console.log('users.length', users.length)

  if (users.length === 0) {
    // wait for the first pull to have completed if we know it comes from an existing store.
    // this works around the 'create default if not present' logic running on a store that has data, just not yet loaded.
    // I am not sure if this is necessary, it was for a previous version... Would need to test again/understand the guarantees livestore provides.
    console.log('No users for now, assuming store needs to be loaded...')
    return null
  }

  return (
    <section>
      <MainSection />
    </section>
  )
}
