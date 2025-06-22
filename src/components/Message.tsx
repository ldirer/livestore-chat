import {useStore} from "@livestore/react";
import {queryDb} from "@livestore/livestore";
import {tables} from "../livestore/schema.ts";
import React from "react";

import {TMessage} from "./ChatView.tsx";

interface MessageProps {
  message: TMessage,
}

export function Message({message}: MessageProps) {
  const {store} = useStore()
  const author = store.useQuery(queryDb(tables.userProfile.where({id: message.authorId})))[0] || {username: 'AnonymousBug'}

  return <div>
    <div style={{fontWeight: "bold"}}>{author.username}</div>
    <div>{message.content}</div>
  </div>;
}