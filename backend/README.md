

The test store is a debug helper.
Sanity-check that sync works with a simple store:

    
    # launch server
    bun src/backend/index.ts

    # in another terminal
    bun src/backend/scripts/create_test_event.ts

    # you should see the new event in the response to:
    http http://localhost:9003/test


I had to attach the test events to the user schema, making the debug helper leak into the 'real code'.
That's because:

- the user schema here is in fact the 'global schema of all events', and test events get replicated to the global event log
- LiveStore crashes if it receives an unknown event. 

That's why a materializer is defined too.
