import { useMemo } from 'react'
import { useLocation } from 'react-router'

/**
 * Hook to get URL parameters from the current location
 * @returns An object with URL search parameters
 */
export const useURLParams = () => {
  const location = useLocation()

  return useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    const params: Record<string, string> = {}

    // Convert URLSearchParams to a plain object
    for (const [key, value] of searchParams.entries()) {
      params[key] = value
    }

    return params
  }, [location.search])
}
