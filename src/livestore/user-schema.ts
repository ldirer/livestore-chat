import { Events, makeSchema, Schema, State } from '@livestore/livestore'

export const events = {
  userProfileCreated: Events.synced({
    name: 'v1.UserProfileCreated',
    schema: Schema.Struct({
      id: Schema.String,
      username: Schema.String,
      email: Schema.String,
      createdAt: Schema.Date,
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
    username: State.SQLite.text(),
    email: State.SQLite.text(),
    createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    updatedAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
  },
})

export const tables = { userProfile: userTable }

const materializers = State.SQLite.materializers(events, {
  // When the user creates or joins a workspace, add it to their workspace table
  'v1.UserProfileCreated': ({ id, email, username, createdAt }) =>
    tables.userProfile.insert({
      id,
      email,
      username,
      createdAt,
      updatedAt: createdAt,
    }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })

export type UserType = typeof tables.userProfile.Type
