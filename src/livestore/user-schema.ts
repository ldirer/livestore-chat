import { Events, makeSchema, Schema, State } from '@livestore/livestore'

export const events = {
  userProfileCreated: Events.synced({
    name: 'v1.UserProfileCreated',
    schema: Schema.Struct({
      id: Schema.String,
      privateId: Schema.String,
      username: Schema.String,
      createdAt: Schema.Date,
    }),
  }),
  userEmailAttached: Events.synced({
    name: 'v1.UserEmailAttached',
    schema: Schema.Struct({
      privateId: Schema.String,
      username: Schema.String,
      email: Schema.String,
    }),
  }),
}

// Table to store basic user info
// Contains only one row as this store is per-user.
const userTable = State.SQLite.table({
  name: 'userprofile',
  columns: {
    // Assuming username is unique and used as the identifier
    id: State.SQLite.text({ primaryKey: true }),
    privateId: State.SQLite.text(),
    username: State.SQLite.text(),
    email: State.SQLite.text(),
    createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    updatedAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
  },
})

export const tables = { userProfile: userTable }

const materializers = State.SQLite.materializers(events, {
  // When the user creates or joins a workspace, add it to their workspace table
  'v1.UserProfileCreated': ({ id, privateId, username, createdAt }) =>
    tables.userProfile.insert({
      id,
      privateId,
      username,
      createdAt,
      updatedAt: createdAt,
      email: '',
    }),
  // LET'S IGNORE THIS EVENT FOR NOW? Make it an API call.
  'v1.UserEmailAttached': ({ privateId, email }) =>
    tables.userProfile.where({ privateId }).update({ email }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
