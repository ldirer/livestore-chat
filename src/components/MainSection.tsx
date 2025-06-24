import type React from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser.ts'

export const MainSection: React.FC = () => {
  const user = useCurrentUser()
  if (!user) {
    // This might flash... eh.
    return <div>Finding you a username...</div>
  }
  return <div>Hello {user.username}!</div>
  // return <ChatView user={user} />
}
