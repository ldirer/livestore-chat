# Authentication Flow 

1. **Initial Login Request**:
- User requests a magic link by entering their email
- Backend finds the user in the aggregated users database, or creates a new one
- Backend generates a magic link, stores it in the auth database, and sends it to the user's email

2. **Magic Link Authentication**:
- User clicks the magic link in their email, the frontend app submits the magic link token to the backend
- Backend validates the token against the auth database and upon success returns three tokens:
    - Access token and refresh token are set as cookies
    - LiveStore token is returned in the response body. It is a JWT with the user stores in the payload

3. **LiveStore Connection**:
- Frontend uses the LiveStore token in `syncPayload` to establish a connection to the Cloudflare sync service
- CloudFlare validates the token in `validatePayload` and verifies the user has access to the requested store based on the JWT payload

4. **Ongoing Data Synchronization**:
- User interactions create events in their user store
- In the sync service, these events are duplicated to the 'serveronly' aggregated store
- Backend materializes these events into the aggregated users database, allowing user lookup on login requests
