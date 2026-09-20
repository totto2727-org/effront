Effront coordinates server-side work, streamed page rendering, and browser updates.
These operations can finish at different times, which affects when users see saved data, which UI state survives navigation, and when request resources can be released.

## Runtime contracts {#chapters}

- [Server Function execution and refresh](/en/advanced/server-function-execution-and-refresh): why a function result can arrive before the updated page, and why refresh ordering does not protect database writes.
- [Client navigation](/en/advanced/client-navigation): what persists between pages, when the URL changes, and how streaming and history affect navigation.
- [Request runtime and lifetimes](/en/advanced/request-runtime-and-lifetimes): why request services remain available after a handler returns, and when their resources are released.

For application setup, use [Getting started](/en/guide/getting-started) and [Platforms](/en/platforms).
For verification, see [Application testing](/en/best-practices/testing#production).
The [Architecture chapters](/en/architecture/implementation/overview) explain the implementation behind these contracts.
