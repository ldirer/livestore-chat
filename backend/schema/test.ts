import { Events, makeSchema, Schema, State } from '@livestore/livestore'

export const events = {
  testEvent: Events.synced({
    name: 'v1.TestEvent',
    schema: Schema.Struct({ id: Schema.String, message: Schema.String }),
  }),
}

const testTable = State.SQLite.table({
  name: 'test',
  columns: {
    id: State.SQLite.text({ primaryKey: true }),
    message: State.SQLite.text(),
  },
})

export const tables = { test: testTable }

const materializers = State.SQLite.materializers(events, {
  'v1.TestEvent': ({ id, message }) => tables.test.insert({ id, message }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
