import {
  Events,
  makeSchema,
  Schema,
  SessionIdSymbol,
  State,
} from '@livestore/livestore'

// You can model your state as SQLite tables (https://docs.livestore.dev/reference/state/sqlite-schema)
export const tables = {
  userProfile: State.SQLite.table({
    name: 'userprofile',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      username: State.SQLite.text(),
      email: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      updatedAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    },
  }),
  message: State.SQLite.table({
    name: 'message',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      authorId: State.SQLite.text(),
      content: State.SQLite.text(),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      updatedAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    },
  }),

  // Client documents can be used for local-only state (e.g. form inputs)
  uiState: State.SQLite.clientDocument({
    name: 'uiState',
    schema: Schema.Struct({}),
    default: { id: SessionIdSymbol, value: {} },
  }),
}

// Events describe data changes (https://docs.livestore.dev/reference/events)
export const events = {
  userProfileCreated: Events.synced({
    name: 'v1.UserProfileCreated',
    schema: Schema.Struct({
      id: Schema.String,
      username: Schema.String,
      createdAt: Schema.Date,
    }),
  }),
  messageCreated: Events.synced({
    name: 'v1.MessageCreated',
    schema: Schema.Struct({
      id: Schema.String,
      content: Schema.String,
      createdAt: Schema.Date,
      authorId: Schema.String,
    }),
  }),
  uiStateSet: tables.uiState.set,
}

// Materializers are used to map events to state (https://docs.livestore.dev/reference/state/materializers)
const materializers = State.SQLite.materializers(events, {
  'v1.MessageCreated': ({ id, content, createdAt, authorId }) =>
    tables.message.insert({
      id,
      content,
      authorId,
      createdAt,
      updatedAt: createdAt,
    }),
  'v1.UserProfileCreated': ({ id, username, createdAt }) =>
    tables.userProfile.insert({
      id,
      username,
      createdAt,
      updatedAt: createdAt,
    }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
