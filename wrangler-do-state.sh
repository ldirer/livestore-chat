#!/usr/bin/env bash

# quick script to read Durable Object state 
for db in /home/laurent/programming/livestore-chat/.wrangler/state/v3/do/websocket-server-WebSocketServer/*.sqlite; do
  echo "==> $db"
  echo -n ".tables: "
  sqlite3 "$db" '.tables'
  for table in $(sqlite3 "$db" '.tables'); do
    echo "--- $table ---"
    sqlite3 -header -column "$db" "SELECT * FROM $table LIMIT 5;"
  done
  echo ""
done
