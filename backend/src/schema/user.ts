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
  'v1.UserProfileCreated': ({ id, username, email, createdAt }) =>
    tables.user.insert({
      id,
      username,
      createdAt,
      updatedAt: createdAt,
      email,
    }),
  'v1.TestEvent': () => {
    console.log('ignoring test event in global user store')
    // undefined or 'noop' makes livestore crash, it wants to run SQL.
    return 'SELECT 1;'
  },
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
