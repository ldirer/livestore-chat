import { makeWorker } from '@livestore/adapter-web/worker'
import { makeCfSync } from '@livestore/sync-cf'

import { schema as userSchema } from './livestore/user-schema.ts'

makeWorker({
  schema: userSchema,
  sync: {
    backend: makeCfSync({ url: import.meta.env.VITE_LIVESTORE_SYNC_URL }),
    initialSyncOptions: { _tag: 'Blocking', timeout: 5000 },
  },
})
