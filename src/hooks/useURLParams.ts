import { useEffect, useState } from 'react'

const getParams = () => {
  const searchParams = new URLSearchParams(window.location.search)
  const params: Record<string, string> = {}

  // Convert URLSearchParams to a plain object
  for (const [key, value] of searchParams.entries()) {
    params[key] = value
  }

  return params
}

/**
 * Hook to get URL parameters from the current location
 * Updates when URL parameters change
 * @returns An object with URL search parameters
 */
export const useURLParams = () => {
  // Parse current URL parameters

  // Initialize state with current parameters
  const [params, setParams] = useState(getParams())

  // Update params when URL search changes
  useEffect(() => {
    console.log('useURLParams useEffect', window.location.search)
    setParams(getParams())
  }, [window.location.search])

  return params
}
