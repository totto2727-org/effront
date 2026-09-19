## Design around asynchronous work {#chapters}

A page needs to behave sensibly while data is loading, a save is in progress, or the user is moving elsewhere.
These guides explain Effront's runtime behavior so you can decide what your interface should show and how long its server-side resources need to remain available.

**When can I show the result of a save?**
[Server Function execution and refresh](/en/advanced/server-function-execution-and-refresh) explains why receiving a function's result and displaying the refreshed page are separate events.
It also covers how overlapping calls and navigation affect which update reaches the screen, and where your application must check authorization and account for input limits.

**What happens when the user leaves a page that is still loading?**
[Client navigation](/en/advanced/client-navigation) explains the relationship between the visible page, the URL, and the response stream during a transition.
It covers cancellation, back and forward navigation, and page transition animations, helping you reason about what users see without assuming that every page has finished loading before they move on.

**When is it safe to release a request's resources?**
[Request runtime and lifetimes](/en/advanced/request-runtime-and-lifetimes) explains how request-scoped services remain available during rendering and response streaming.
It covers cleanup when work completes, fails, or is cancelled, helping you avoid releasing resources while a response still needs them.

These guides focus on behavior during a request or user interaction.
The basic page-building workflow is in [Getting started](/en/guide/getting-started), and host-specific development and startup configuration is in [Platforms](/en/platforms).
[Application testing](/en/best-practices/testing#production) covers checking behavior in your application, while [Architecture](/en/architecture/implementation/overview) explains the implementation behind these contracts.
