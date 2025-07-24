import { makeWorker } from '@livestore/adapter-web/worker'
import { makeCfSync } from '@livestore/sync-cf'
import { LIVESTORE_SYNC_URL } from './config.ts'
import { schema as userSchema } from './livestore/user-schema.ts'

makeWorker({
  schema: userSchema,
  sync: {
    backend: makeCfSync({ url: LIVESTORE_SYNC_URL }),
    initialSyncOptions: { _tag: 'Blocking', timeout: 5000 },
  },
})
