#!/usr/bin/env bash


echo "dropping sync worker table"
sqlite3 \
/home/laurent/programming/livestore-chat/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/6990e75e9ec97ceb51567e044c803debd2fe769e3d7b53f1c0f5aa67e60fdc01.sqlite \
"DROP TABLE eventlog_7_test_store;"


echo "clearing durable object storage - might remember obsolete 'current head'"
rm .wrangler/state/v3/do/websocket-server-WebSocketServer/*


echo "clearing backend server tables for test-store"
rm .server-livestore-adapter/test-store/*.db


