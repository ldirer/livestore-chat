import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { SERVER_BASE_URL } from '../config.ts'
import { useURLParams } from '../hooks/useURLParams.ts'

const LIVESTORE_TOKEN_KEY = 'livestoreToken'

function setLivestoreToken(token: string): void {
  localStorage.setItem(LIVESTORE_TOKEN_KEY, token)
}

const useEmailLoginToken = () => {
  const params = useURLParams()
  return params.token
}

type LoginState = 'loading' | 'success' | 'error'

type LoginErrorCode =
  | 'EXPIRED' // Token has expired
  | 'ALREADY_USED' // Token was already used
  | 'TOKEN_NOT_FOUND' // Token doesn't exist in database
  | 'VALIDATION_ERROR' // Missing token in request
  | 'NO_TOKEN' // No token provided in URL
  | 'NETWORK_ERROR' // Network/connection error
  | 'INTERNAL_ERROR' // Server error
  | 'UNKNOWN_ERROR' // Fallback for unexpected errors

type LoginError = {
  code: LoginErrorCode
  message?: string
}

export const MagicLoginPage = () => {
  // 'magic link' login: extract the token from url, use it to log in with the server and redirect to the home page
  const token = useEmailLoginToken()
  const navigate = useNavigate()
  const [state, setState] = useState<LoginState>('loading')
  const [error, setError] = useState<LoginError | null>(null)

  useEffect(() => {
    if (token !== undefined) {
      // Submit the magic link token to the backend
      fetch(`${SERVER_BASE_URL}/auth/submit-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
        credentials: 'include', // required for cookies to be persisted cross origin
      })
        .then(async (response) => {
          const data = await response.json()

          if (response.ok) {
            // Store livestoreToken
            setLivestoreToken(data.livestoreToken)

            // Login successful, redirect to home page
            navigate('/')
          } else {
            // Login failed
            setState('error')
            const errorCode = data.error?.code
            setError({
              code:
                errorCode === 'EXPIRED' ||
                errorCode === 'ALREADY_USED' ||
                errorCode === 'TOKEN_NOT_FOUND' ||
                errorCode === 'VALIDATION_ERROR' ||
                errorCode === 'INTERNAL_ERROR'
                  ? (errorCode as LoginErrorCode)
                  : 'UNKNOWN_ERROR',
              message: data.error?.message || 'Login failed',
            })
          }
        })
        .catch((err) => {
          console.error('Login error:', err)
          setState('error')
          setError({
            code: 'NETWORK_ERROR',
            message: 'Unable to connect to server',
          })
        })
    } else {
      // No token provided
      setState('error')
      setError({
        code: 'NO_TOKEN',
        message: 'No login token provided',
      })
    }
  }, [token])

  if (state === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>Logging you in...</h2>
        <div>Please wait while we verify your login link.</div>
      </div>
    )
  }

  if (state === 'error') {
    const getErrorMessage = (error: LoginError): string => {
      switch (error.code) {
        case 'EXPIRED':
          return 'Your login link has expired. Please request a new one.'
        case 'ALREADY_USED':
          return 'This login link has already been used. Please request a new one.'
        case 'TOKEN_NOT_FOUND':
          return 'Invalid login link. Please request a new one.'
        case 'VALIDATION_ERROR':
          return 'Invalid request format. Please try again.'
        case 'NO_TOKEN':
          return 'No login token provided. Please check your link and try again.'
        case 'NETWORK_ERROR':
          return 'Unable to connect to server. Please check your connection and try again.'
        case 'INTERNAL_ERROR':
          return 'Server error occurred. Please try again later.'
        case 'UNKNOWN_ERROR':
          return (
            error.message || 'An unexpected error occurred. Please try again.'
          )
        default: {
          // This ensures exhaustive checking - TypeScript will error if we miss a case
          const _exhaustiveCheck: never = error.code
          return (
            error.message || 'An unexpected error occurred. Please try again.'
          )
        }
      }
    }

    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>❌ Login Failed</h2>
        <div style={{ marginBottom: '1rem' }}>{getErrorMessage(error!)}</div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Go to Home Page
        </button>
      </div>
    )
  }

  return null
}
