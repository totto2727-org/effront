Effront combines React Server Components with Effect to build pages that read server-side data and respond to user actions.
Write the interface in React, and use Effect to describe the server-side work it needs.

## Get a page on screen {#boundaries}

Start with [Getting started](./guide/getting-started.md).
You will define a page and its layout, connect the page to a URL, and run the application locally to see `Hello, Effront` in your browser.
Keep this small application as the starting point for your own pages.

The host determines how you start and deploy that application.
Effront provides adapters for Cloudflare Workers, Node.js, and Bun.
If you already have a target environment, use [Platforms](./platforms.md) to find its development and production setup.

## Add data and user actions {#overview}

A useful next milestone is a page that displays data and lets a visitor change it.
Build toward that in three steps:

1. **Give the page an address:** Use [Routing](./guide/routes.md) to connect URLs to pages, read route parameters, and share a layout across related pages.
2. **Load the data the page needs:** A page's render function returns an Effect containing React content.
   [Service injection](./guide/effect.md) shows how to provide a service and use it while rendering, keeping data access separate from the interface.
3. **Handle an action from the browser:** Use [Server Functions](./guide/server-functions.md) to validate input and run an Effect handler on the server.
   The guide shows a form submission returning a result from a server-side service.

For a read-only page, stop after rendering the data.
Add an action when the feature needs user input.

## Choose your next guide {#next}

With the basic flow in place, focus on the part you want to develop next.

- **Content and appearance:** [Markdown](./guide/markdown.md) covers rendering articles, while [Styling](./guide/styling.md) adds Tailwind CSS to your application.
- **Behavior across requests and navigation:** [Runtime contracts](./advanced.md) explains service lifetimes and when the screen updates.
- **Confidence in your application:** [Testing applications](./best-practices/testing.md) helps you combine tests of application logic with browser checks.

For a specific option or type, go directly to the [API reference](./api-reference.md).
For the implementation behind these APIs, read the [architecture walkthrough](/en/architecture/implementation/overview).
