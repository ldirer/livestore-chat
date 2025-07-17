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
      // this is here only to help with debugging (identifying event source)
      username: Schema.String,
      email: Schema.String,
    }),
  }),
  // if this isn't included, the store crashes on boot if the initial sync sees these events. All events need to be defined.
  // we can ignore them in materialization (noop).
  testEvent: Events.synced({
    name: 'v1.TestEvent',
    schema: Schema.Struct({ id: Schema.String, message: Schema.String }),
  }),
}

const userTable = State.SQLite.table({
  name: 'userprofile',
  columns: {
    id: State.SQLite.text({ primaryKey: true }),
    privateId: State.SQLite.text(),
    username: State.SQLite.text(),
    email: State.SQLite.text(),
    createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    updatedAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
  },
})

const testTable = State.SQLite.table({
  name: 'test',
  columns: {
    id: State.SQLite.text({ primaryKey: true }),
    message: State.SQLite.text(),
  },
})
export const tables = { user: userTable, test: testTable }

const materializers = State.SQLite.materializers(events, {
  'v1.UserProfileCreated': ({ id, privateId, username, createdAt }) =>
    tables.user.insert({
      id,
      privateId,
      username,
      createdAt,
      updatedAt: createdAt,
      email: '',
    }),
  'v1.UserEmailAttached': ({ privateId, email }) =>
    tables.user.where({ privateId }).update({ email }),
  'v1.TestEvent': () => {
    console.log('ignoring test event in global user store')
    // undefined or 'noop' makes livestore crash, it wants to run SQL.
    return 'SELECT 1;'
  },
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
