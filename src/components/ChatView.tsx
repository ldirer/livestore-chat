import { queryDb } from '@livestore/livestore'
import { useStore } from '@livestore/react'
import React from 'react'
import { events, tables } from '../livestore/workspace-schema.ts'
import { ChatMessageInput } from './ChatMessageInput.tsx'
import { Message } from './Message.tsx'

export type TMessage = Pick<typeof tables.message.Type, 'content' | 'authorId'>

interface ChatViewProps {
  user: typeof tables.userProfile.Type
}

export function ChatView({ user }: ChatViewProps) {
  const { store } = useStore()
  const messages = store.useQuery(queryDb(tables.message))

  const handleSubmit = React.useCallback(
    ({ content }: Pick<TMessage, 'content'>) => {
      store.commit(
        events.messageCreated({
          id: crypto.randomUUID(),
          content,
          createdAt: new Date(),
          authorId: user.id,
        }),
      )
    },
    [store, user],
  )

  return (
    <>
      <h1>Welcome to the Chat.</h1>

      {messages.length === 0 && <div>No messages yet.</div>}
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      <ChatMessageInput onSubmit={handleSubmit} />
    </>
  )
}
