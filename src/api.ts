import { SERVER_BASE_URL } from './config.ts'

const LIVESTORE_TOKEN_KEY = 'livestoreToken'

export function getLivestoreToken(): string | null {
  return localStorage.getItem(LIVESTORE_TOKEN_KEY)
}

function setLivestoreToken(token: string): void {
  localStorage.setItem(LIVESTORE_TOKEN_KEY, token)
}

export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: 'include', // send cookies
  })

  if (res.status !== 401 && res.status !== 403) return res

  // Attempt token refresh
  const refreshRes = await fetch(`${SERVER_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  // this shouldn't really happen outside of bugs - a refresh token that expires naturally only does so after a long inactivity
  // handling errors for the 'first request' should suffice to handle refresh token expiration errors
  // could use a structured error value
  if (!refreshRes.ok) throw new Error('Auth refresh failed')

  // Extract and store livestoreToken from refresh response
  const refreshData = await refreshRes.json()
  setLivestoreToken(refreshData.livestoreToken)

  // Retry original request
  return fetch(input, {
    ...init,
    credentials: 'include',
  })
}
