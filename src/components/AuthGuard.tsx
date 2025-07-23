import { createContext, type ReactNode, useContext } from 'react'
import { getLivestoreToken } from '../api.ts'
import { type UserInfo, useAuthState } from '../hooks/useAuthState.ts'
import { EmailLoginForm } from './EmailLoginForm.tsx'

// Create a context to provide the authenticated user
interface AuthContextType {
  user: UserInfo
  livestoreToken: string
}

const AuthContext = createContext<AuthContextType | null>(null)

// Hook to access the authenticated user from components below AuthGuard
export const useAuthenticatedUserInfo = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthenticatedUser must be used within an AuthGuard')
  }
  return context
}

interface AuthGuardProps {
  children: ReactNode
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const authState = useAuthState()

  if (authState.loading) {
    // This might flash... eh.
    return <div>Loading your data...</div>
  }

  if (authState.error !== null) {
    // later: show email login form "looks like you are not signed in..."
    return <EmailLoginForm />
  }

  const authContextValue: AuthContextType = {
    user: authState.user,
    // we just checked the user was authenticated, we should have a token
    livestoreToken: getLivestoreToken()!,
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  )
}
