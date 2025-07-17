import type React from 'react'
import { useCurrentUserStores } from '../hooks/useCurrentUserStores.ts'

export const MainSection: React.FC = () => {
  const authState = useCurrentUserStores()
  return <div>Hello {authState.user?.username}!</div>
  // return <ChatView user={user} />
}
