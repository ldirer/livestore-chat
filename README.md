# A Chat with LiveStore

The goal is to start from a very basic application and tackle typical web development topics as the app grows.

## Running locally

```bash
export VITE_LIVESTORE_SYNC_URL='http://localhost:8787'
bun dev
```


Clear auth server backend storage: 

```
rm -r .server-livestore-adapter/*
```


# Ugh

The backend TS server uses the frontend package.json.
If it just works.
Temporary of course... I'm hoping tree shaking makes it all work ok. The backend imports code from frontend (livestore schemas).

Eventually I just copied stuff so there shouldn't be imports, which is just simpler in this case (avoids confusion too).

## Deployment

Using Netlify for the static build. Could have used CloudFlare for both...
I just copied the example from the LiveStore repo (they have several examples, not all CloudFlare).

Build:
```
VITE_SERVER_BASE_URL="https://livestore-chat-backend.fly.dev/" VITE_LIVESTORE_SYNC_URL="$PROD_WRANGLER_DEPLOY" bun run build 
```

Deploy worker to cloudflare and JS to netlify:
```
wrangler deploy
bunx netlify deploy --no-build --prod --dir=./dist --site="$NETLIFY_SITE_ID" 
```
