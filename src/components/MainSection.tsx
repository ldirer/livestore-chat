import type React from 'react'
import { useAuthenticatedUserInfo } from './AuthGuard.tsx'

export const MainSection: React.FC = () => {
  const { user } = useAuthenticatedUserInfo()
  return <div>Hello {user.username}!</div>
}
