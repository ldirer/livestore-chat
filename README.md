# A Chat with LiveStore

The goal is to start from a very basic application and tackle typical web development topics as the app grows.

## Running locally

```bash
export VITE_LIVESTORE_SYNC_URL='http://localhost:8787'
bun dev
```


## Deployment

Using Netlify for the static build. Could have used CloudFlare for both...
I just copied the example from the LiveStore repo (they have several examples, not all CloudFlare).

Build:
```
VITE_LIVESTORE_SYNC_URL="$PROD_WRANGLER_DEPLOY" bun run build 
```

Deploy worker to cloudflare and JS to netlify:
```
wrangler deploy
bunx netlify deploy --no-build --prod --dir=./dist --site="$NETLIFY_SITE_ID" 
```