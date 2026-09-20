import type { DocPage } from "../types";

export const englishArticleCatalog = [
  {
    slug: "/",
    title: "Effront",
    description:
      "Build React pages with server-side data and user actions, then choose the guide for your next step.",
    section: "Getting started",
    headings: [
      { id: "boundaries", title: "Get a page on screen" },
      { id: "overview", title: "Add data and user actions" },
      { id: "next", title: "Choose your next guide" },
    ],
    source: "/index",
  },
  {
    slug: "/guide/getting-started",
    title: "Getting started",
    description: "Create a homepage and run it locally on your chosen host.",
    section: "Getting started",
    headings: [
      { id: "setup", title: "Prepare your project" },
      { id: "application", title: "Define the homepage" },
      { id: "files", title: "Connect the application to a host" },
      { id: "run", title: "See the result and make it your own" },
    ],
    source: "/guide/getting-started",
  },
  {
    slug: "/platforms",
    title: "Deployment platforms",
    description:
      "Choose a hosting model, start development locally, and find the production checks for Wrangler or Node.js and Bun.",
    section: "Platforms",
    headings: [
      { id: "support", title: "Choose your hosting model" },
      { id: "architecture", title: "Set up local development" },
      { id: "build-startup", title: "Prepare production startup and assets" },
    ],
    source: "/platforms",
  },
  {
    slug: "/platforms/cloudflare",
    title: "Cloudflare Workers",
    description:
      "Connect an existing app to Cloudflare Workers, configure assets and environment values, and verify it locally.",
    section: "Platforms",
    headings: [
      { id: "setup", title: "Connect your application to a Worker" },
      { id: "vite", title: "Configure the Worker and build" },
      { id: "local", title: "Run and verify your application" },
      { id: "context", title: "Add application configuration" },
      { id: "secrets", title: "Keep credentials on the server" },
      { id: "alchemy", title: "Use Alchemy instead" },
    ],
    source: "/platforms/cloudflare",
  },
  {
    slug: "/platforms/node-bun",
    title: "Node.js and Bun",
    description:
      "Develop in Vite, then build and launch a Node.js or Bun server that serves pages and browser assets.",
    section: "Platforms",
    headings: [
      { id: "setup", title: "Install the server integration" },
      { id: "entries", title: "Verify the application in Vite" },
      { id: "assets", title: "Prepare the production asset layout" },
      { id: "node", title: "Build and launch a Node.js server" },
      { id: "bun", title: "Use Bun for the production server" },
    ],
    source: "/platforms/node-bun",
  },
  {
    slug: "/platforms/alchemy",
    title: "Alchemy and Cloudflare",
    description: "Run an existing Effront app locally with Alchemy and add KV storage when needed.",
    section: "Platforms",
    headings: [
      { id: "setup", title: "Prepare an existing Effront app" },
      { id: "worker", title: "Declare the app Alchemy will run" },
      { id: "stack", title: "Start development and open a page" },
      { id: "capabilities", title: "Add bindings" },
    ],
    source: "/platforms/alchemy",
  },
  {
    slug: "/guide/routes",
    title: "Pages, layouts, and routes",
    description:
      "Connect URLs to pages, validate route parameters, and group related pages under shared layouts and loading UI.",
    section: "Guides",
    headings: [
      { id: "pages", title: "Register a Page" },
      { id: "matching", title: "Read URL parameters" },
      { id: "mount", title: "Add a section layout and loading UI" },
    ],
    source: "/guide/routes",
  },
  {
    slug: "/guide/components",
    title: "Server and Client Components",
    description:
      "Keep data access on the server while adding reusable UI and interactive controls.",
    section: "Guides",
    headings: [
      { id: "boundary", title: "Choose a component for the task" },
      { id: "server", title: "Reuse server-rendered UI" },
      { id: "client-boundary", title: "Add an interactive control" },
    ],
    source: "/guide/components",
  },
  {
    slug: "/guide/server-functions",
    title: "Server Functions",
    description:
      "Submit validated form data to a Server Function and display its result with useActionState.",
    section: "Guides",
    headings: [
      { id: "identity", title: "Share the application definition" },
      { id: "state", title: "Return form state" },
      { id: "application", title: "Render and submit the form" },
      { id: "forms", title: "Submit without returning state" },
      { id: "input", title: "Accept an object argument" },
      { id: "refresh", title: "Handle updates and failures" },
    ],
    source: "/guide/server-functions",
  },
  {
    slug: "/guide/effect",
    title: "Application services",
    description:
      "Supply a Page with a typed service, choose its implementation, and manage its request-scoped resources.",
    section: "Guides",
    headings: [
      { id: "service", title: "Use a service in a Page" },
      { id: "lifetime", title: "Choose the service scope" },
      { id: "missing-services", title: "Fix missing-service errors" },
    ],
    source: "/guide/effect",
  },
  {
    slug: "/guide/middleware",
    title: "Middleware",
    description: "Prepare request data and enforce checks for selected pages and Server Functions.",
    section: "Guides",
    headings: [
      { id: "reach", title: "Choose the request scope" },
      { id: "view", title: "Provide a request service" },
      { id: "routes", title: "Apply the service to a Page" },
      { id: "order", title: "Return an early response" },
      { id: "actions", title: "Apply checks to a Server Function" },
    ],
    source: "/guide/middleware",
  },
  {
    slug: "/guide/http",
    title: "HTTP endpoints",
    description:
      "Add a JSON endpoint that shares your Page's services and apply headers across Page and API responses.",
    section: "Guides",
    headings: [
      { id: "router", title: "Define a JSON endpoint" },
      { id: "services", title: "Register the route and its service" },
      { id: "boundary", title: "Keep resources request-local" },
      { id: "global", title: "Add a shared response header" },
    ],
    source: "/guide/http",
  },
  {
    slug: "/guide/markdown",
    title: "Writing pages in Markdown",
    description:
      "Publish a Markdown article at a chosen URL, connect related content and assets, and customize parsing when needed.",
    section: "Guides",
    headings: [
      { id: "setup", title: "Add an article" },
      { id: "collection", title: "Load the collection" },
      { id: "render", title: "Render the article at its URL" },
      { id: "authoring", title: "Customize parsing or rendering" },
    ],
    source: "/guide/markdown",
  },
  {
    slug: "/guide/styling",
    title: "Styling with Tailwind",
    description:
      "Start with Tailwind utilities, then add shared theme values or plugins when your design needs them.",
    section: "Guides",
    headings: [
      { id: "setup", title: "Add Tailwind utilities" },
      { id: "stylesheet", title: "Define a theme in a stylesheet" },
      { id: "scope", title: "Add an optional Tailwind plugin" },
    ],
    source: "/guide/styling",
  },
  {
    slug: "/advanced",
    title: "Runtime behavior",
    description: "Plan user feedback, navigation, and resource cleanup around asynchronous work.",
    section: "Guides",
    headings: [{ id: "chapters", title: "Runtime contracts" }],
    source: "/advanced",
    group: "Runtime behavior",
  },
  {
    slug: "/advanced/request-runtime-and-lifetimes",
    title: "Request and resource lifetimes",
    description:
      "Keep request resources available during rendering and streaming, and release them when the response finishes or is interrupted.",
    section: "Guides",
    headings: [
      { id: "response-lifetime", title: "A Response can outlive its handler" },
      { id: "request-layer", title: "Application services belong to each request" },
      { id: "render-scope", title: "Delayed rendering uses the same services" },
      { id: "resource-design", title: "Request-owned and host-owned resources" },
    ],
    source: "/advanced/request-runtime-and-lifetimes",
    group: "Runtime behavior",
  },
  {
    slug: "/advanced/client-navigation",
    title: "Client navigation",
    description:
      "Preserve shared UI state where client navigation is supported, and plan page animations, loading, and browser history behavior.",
    section: "Guides",
    headings: [
      { id: "native-navigation", title: "What persists between pages" },
      { id: "transition-scope", title: "Page transitions and persistent Layouts" },
      { id: "commit-and-stream", title: "Display, URL, and stream completion" },
      { id: "history-cache", title: "History reuse and document loads" },
    ],
    source: "/advanced/client-navigation",
    group: "Runtime behavior",
  },
  {
    slug: "/advanced/server-function-execution-and-refresh",
    title: "Server Function results and refresh",
    description:
      "Decide when to show a save result, protect server writes, and handle overlapping submissions and page refreshes.",
    section: "Guides",
    headings: [
      { id: "execution", title: "One call returns a result and a refreshed page" },
      { id: "input-boundary", title: "Validation is not authorization" },
      { id: "result-and-refresh", title: "The result can arrive before the view" },
      { id: "concurrency", title: "Refresh ordering is not write ordering" },
    ],
    source: "/advanced/server-function-execution-and-refresh",
    group: "Runtime behavior",
  },
  {
    slug: "/best-practices/testing",
    title: "Testing your application",
    description:
      "Test a user journey, cover its business rules, and repeat the checks against your release build.",
    section: "Best practices",
    headings: [
      { id: "pages", title: "Test a persisted change in the browser" },
      { id: "services", title: "Test rules below the Server Function" },
      { id: "production", title: "Verify the release artifact" },
      { id: "tools", title: "Isolate data and automate startup" },
    ],
    source: "/best-practices/testing",
  },
  {
    slug: "/api-reference",
    title: "API reference",
    description:
      "Find public import paths, application factory APIs, and compatible dependency versions.",
    section: "API reference",
    headings: [
      { id: "exports", title: "Public API map" },
      { id: "index", title: "Application factory index" },
      { id: "versions", title: "Dependency matrix" },
    ],
    source: "/api-reference",
  },
  {
    slug: "/api-reference/application",
    title: "Application",
    description:
      "Assemble an application from pages, routes, and services, and check how to extend selected definitions with middleware.",
    section: "API reference",
    headings: [
      { id: "example", title: "Application definition example" },
      { id: "identity", title: "Application.effront" },
      { id: "make", title: "EFFRONT.make" },
      { id: "middleware", title: "EFFRONT.withMiddleware" },
    ],
    source: "/api-reference/application",
  },
  {
    slug: "/api-reference/components",
    title: "Component, Page, Layout, and Loading",
    description:
      "Choose rendering factories, add layouts and loading UI, and check URL parameter and page transition options.",
    section: "API reference",
    headings: [
      { id: "render", title: "Rendering factories" },
      { id: "loading", title: "Layout and Loading" },
      { id: "params", title: "Page params" },
      { id: "view-transition", title: "PageViewTransition" },
    ],
    source: "/api-reference/components",
  },
  {
    slug: "/api-reference/routing",
    title: "Routes and Middleware",
    description:
      "Compose route groups, match URL parameters, and apply Middleware to the requests a section handles.",
    section: "API reference",
    headings: [
      { id: "routes", title: "Routes" },
      { id: "paths", title: "Route paths" },
      { id: "middleware", title: "Middleware" },
    ],
    source: "/api-reference/routing",
  },
  {
    slug: "/api-reference/server-functions",
    title: "ServerFn",
    description:
      "Check accepted inputs, handler signatures, and authorization requirements when exposing a server operation to React.",
    section: "API reference",
    headings: [
      { id: "make", title: "ServerFn.make" },
      { id: "arguments", title: "Argument shapes" },
      { id: "execution", title: "Execution constraints" },
    ],
    source: "/api-reference/server-functions",
  },
  {
    slug: "/api-reference/workers",
    title: "Fetch handlers and Workers context",
    description:
      "Create a Fetch entry point and read the current request, environment bindings, and execution context from application Effects.",
    section: "API reference",
    headings: [
      { id: "fetch", title: "createFetchHandler" },
      { id: "readers", title: "Core context readers" },
      { id: "cloudflare", title: "Cloudflare context readers" },
      { id: "context", title: "WorkersRequestContext" },
    ],
    source: "/api-reference/workers",
  },
  {
    slug: "/api-reference/vite",
    title: "Vite and Cloudflare plugins",
    description:
      "Register Effront with Vite and look up entry-file options and Cloudflare Workers configuration.",
    section: "API reference",
    headings: [
      { id: "effront", title: "effront" },
      { id: "configuration", title: "EffrontViteOptions" },
      { id: "cloudflare", title: "effrontCloudflare" },
    ],
    source: "/api-reference/vite",
  },
  {
    slug: "/api-reference/http",
    title: "Effect HTTP handlers",
    description:
      "Connect your application to an Effect HTTP host and supply the services needed to handle and stream responses.",
    section: "API reference",
    headings: [
      { id: "fetch", title: "HTTP boundaries" },
      { id: "handler", title: "toHttpEffect" },
      { id: "capture", title: "makeHttpEffect" },
    ],
    source: "/api-reference/http",
  },
  {
    slug: "/api-reference/server",
    title: "Node.js and Bun server APIs",
    description:
      "Configure build entries, launch a production listener, and serve static files on Node.js or Bun.",
    section: "API reference",
    headings: [
      { id: "vite", title: "effrontServer" },
      { id: "serve", title: "serve" },
      { id: "assets", title: "withAssets" },
    ],
    source: "/api-reference/server",
  },
  {
    slug: "/api-reference/markdown",
    title: "Markdown API",
    description:
      "Look up documents, configure Markdown parsing, and resolve links to articles and assets.",
    section: "API reference",
    headings: [
      { id: "collection", title: "createMarkdownCollection" },
      { id: "parse", title: "parseMarkdown" },
      { id: "references", title: "Links, assets, and MarkdownError" },
    ],
    source: "/api-reference/markdown",
  },
  {
    slug: "/api-reference/alchemy",
    title: "Alchemy API",
    description:
      "Create an Alchemy Worker handler, supply application services, and configure its Vite build.",
    section: "API reference",
    headings: [
      { id: "http", title: "HTTP handlers" },
      { id: "vite", title: "effrontAlchemy" },
    ],
    source: "/api-reference/alchemy",
  },
  {
    slug: "/api-reference/tailwind",
    title: "Tailwind API",
    description:
      "Enable Tailwind's default utilities and use the stylesheet option for custom themes or plugins.",
    section: "API reference",
    headings: [
      { id: "plugin", title: "effrontTailwind" },
      { id: "stylesheet", title: "stylesheet" },
    ],
    source: "/api-reference/tailwind",
  },
] as const satisfies readonly (Omit<DocPage, "content"> & { readonly source: string })[];
