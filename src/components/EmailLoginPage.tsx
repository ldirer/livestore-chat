import { useEffect } from 'react'
import { useURLParams } from '../hooks/useURLParams.ts'

const useEmailLoginToken = () => {
  const params = useURLParams()
  return params.token
}
const EmailLoginPage = () => {
  // 'magic link' login: extract the token from url, use it to log in with the server and redirect to the home page
  const token = useEmailLoginToken()
  useEffect(() => {
    if (token !== undefined) {
      fetch('/auth/submit-magic-link', { token }).then((response) => {
        // cookies should now be set
        // TODO use navigation or something, replace history to redirect to /
      })
    }
  }, [token])

  return <div>Logging you in...</div>
}
