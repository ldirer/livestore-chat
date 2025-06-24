import { queryDb } from '@livestore/livestore'
import { useStore } from '@livestore/react'
import { tables } from '../livestore/schema.ts'

import type { TMessage } from './ChatView.tsx'

interface MessageProps {
  message: TMessage
}

export function Message({ message }: MessageProps) {
  const { store } = useStore()
  const author = store.useQuery(
    queryDb(tables.userProfile.where({ id: message.authorId })),
  )[0] || { username: 'AnonymousBug' }

  return (
    <div>
      <div style={{ fontWeight: 'bold' }}>{author.username}</div>
      <div>{message.content}</div>
    </div>
  )
}
