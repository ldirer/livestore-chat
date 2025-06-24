export const getStoreId = () => {
  if (typeof window === 'undefined') return 'unused'

  const searchParams = new URLSearchParams(window.location.search)
  const storeId = searchParams.get('storeId')
  if (storeId !== null) return storeId

  const newAppId = crypto.randomUUID()
  searchParams.set('storeId', newAppId)

  window.location.search = searchParams.toString()
}

export const getUserStoreId = () => {
  if (typeof window === 'undefined') {
    console.error('unexpected window is undefined')
    return 'unused'
  }

  const USER_STORE_ID_KEY = 'userStoreId'

  // Check if storeId is in URL params first
  // TODO@ldirer this does not work well with the username param. Makes sense...
  const searchParams = new URLSearchParams(window.location.search)
  const urlStoreId = searchParams.get('storeId')
  if (urlStoreId !== null) {
    localStorage.setItem(USER_STORE_ID_KEY, urlStoreId)
    return urlStoreId
  }

  const userStoreId = localStorage.getItem(USER_STORE_ID_KEY)
  if (userStoreId !== null) return userStoreId

  const newUserId = crypto.randomUUID()
  localStorage.setItem(USER_STORE_ID_KEY, newUserId)

  return newUserId
}
