import { useState } from 'react'

type SubmissionState = 'idle' | 'loading' | 'success' | 'error'

export const EmailLoginForm = () => {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmissionState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setErrorMessage('Please enter your email address')
      return
    }

    setState('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/auth/request-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (response.ok) {
        setState('success')
      } else {
        const data = await response.json()
        setState('error')
        setErrorMessage(data.error?.message || 'Failed to send magic link')
      }
    } catch (err) {
      console.error('Magic link request error:', err)
      setState('error')
      setErrorMessage('Unable to connect to server. Please try again.')
    }
  }

  if (state === 'success') {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '2rem',
          maxWidth: '400px',
          margin: '0 auto',
        }}
      >
        <h2>✅ Check your email</h2>
        <p>
          We've sent you an email with a magic link to sign in. Click it to
          continue.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2rem',
        maxWidth: '400px',
        margin: '0 auto',
      }}
    >
      <h2>Sign in or Sign up</h2>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Enter your email to get started
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={state === 'loading'}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={state === 'loading'}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            backgroundColor: state === 'loading' ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
          {state === 'loading' ? 'Sending...' : 'Send magic link'}
        </button>
      </form>

      {state === 'error' && errorMessage && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fee',
            color: '#c33',
            borderRadius: '4px',
            fontSize: '0.9em',
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  )
}
