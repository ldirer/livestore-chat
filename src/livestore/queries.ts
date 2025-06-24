import { queryDb } from '@livestore/livestore'

import { tables } from './workspace-schema.ts'

export const uiState$ = queryDb(tables.uiState.get(), { label: 'uiState' })
