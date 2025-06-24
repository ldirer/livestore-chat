import type React from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser.ts'
import { ChatView } from './ChatView.tsx'

export const MainSection: React.FC = () => {
  const user = useCurrentUser()
  if (!user) {
    // This might flash... eh.
    return <div>Finding you a username...</div>
  }
  return <ChatView user={user} />
}
