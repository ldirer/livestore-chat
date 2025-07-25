import { makePersistedAdapter } from '@livestore/adapter-web'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { queryDb } from '@livestore/livestore'
import { LiveStoreProvider, useStore } from '@livestore/react'
import { FPSMeter } from '@overengineering/fps-meter'
import type React from 'react'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthGuard, useAuthenticatedUserInfo } from './components/AuthGuard.tsx'
import { MagicLoginPage } from './components/MagicLoginPage.tsx'
import {
  tables,
  type UserType,
  schema as userSchema,
} from './livestore/user-schema.ts'
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
      syncPayload={{ authToken: livestoreToken, storeId: userStoreId }}
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<MagicLoginPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <MainPage />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

const AppBody: React.FC = () => {
  const { store } = useStore()
  const { user } = useAuthenticatedUserInfo()
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
    <section style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>Hello {user.username}! (username info from API)</div>
      <div>
        Store contents:
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>ID</th>
              <th style={tableHeaderStyle}>Username</th>
              <th style={tableHeaderStyle}>Email</th>
              <th style={tableHeaderStyle}>Created at</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <StoreUser key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const tableHeaderStyle = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left' as const,
}
const tableCellStyle = { border: '1px solid #ddd', padding: '8px' }

const StoreUser = ({ user }: { user: UserType }) => {
  return (
    <tr>
      <td style={tableCellStyle}>{user.id}</td>
      <td style={tableCellStyle}>{user.username}</td>
      <td style={tableCellStyle}>{user.email}</td>
      <td style={tableCellStyle}>{user.createdAt.toLocaleString()}</td>
    </tr>
  )
}
