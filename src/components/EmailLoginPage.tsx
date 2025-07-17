import { useEffect } from 'react'
import { useURLParams } from '../hooks/useURLParams.ts'

const useEmailLoginToken = (): TaggedStoreId[] => {
  const params = useURLParams()
  return params.token
}
const EmailLoginPage = () => {
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
