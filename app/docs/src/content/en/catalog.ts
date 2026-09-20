import type { DocPage } from "../types";

export const englishArticleCatalog = [
  {
    slug: "/",
    title: "Effront",
    description:
      "Build React pages with server-side data and user actions, then choose the guide for your next step.",
    section: "Getting started",
    headings: [
      {
        id: "boundaries",
        title: "Get a page on screen",
      },
      {
        id: "overview",
        title: "Add data and user actions",
      },
      {
        id: "next",
        title: "Choose your next guide",
      },
    ],
    source: "/index",
  },
  {
    slug: "/guide/getting-started",
    title: "Getting started",
    description: "Create a homepage and run it locally on Cloudflare Workers.",
    section: "Getting started",
    headings: [
      {
        id: "setup",
        title: "Prepare your project",
      },
      {
        id: "application",
        title: "Define the homepage",
      },
      {
        id: "files",
        title: "Connect the application to Workers",
      },
      {
        id: "run",
        title: "See the result and make it your own",
      },
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
      {
        id: "support",
        title: "Choose your hosting model",
      },
      {
        id: "architecture",
        title: "Set up local development",
      },
      {
        id: "build-startup",
        title: "Prepare production startup and assets",
      },
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
      {
        id: "setup",
        title: "Connect your application to a Worker",
      },
      {
        id: "vite",
        title: "Configure the Worker and build",
      },
      {
        id: "local",
        title: "Run and verify your application",
      },
      {
        id: "context",
        title: "Add application configuration",
      },
      {
        id: "secrets",
        title: "Keep credentials on the server",
      },
      {
        id: "alchemy",
        title: "Use Alchemy instead",
      },
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
      {
        id: "setup",
        title: "Install the server integration",
      },
      {
        id: "entries",
        title: "Verify the application in Vite",
      },
      {
        id: "assets",
        title: "Prepare the production asset layout",
      },
      {
        id: "node",
        title: "Build and launch a Node.js server",
      },
      {
        id: "bun",
        title: "Use Bun for the production server",
      },
    ],
    source: "/platforms/node-bun",
  },
  {
    slug: "/platforms/alchemy",
    title: "Alchemy and Cloudflare",
    description: "Run an existing Effront app locally with Alchemy and add KV storage when needed.",
    section: "Platforms",
    headings: [
      {
        id: "setup",
        title: "Prepare an existing Effront app",
      },
      {
        id: "worker",
        title: "Declare the app Alchemy will run",
      },
      {
        id: "stack",
        title: "Start development and open a page",
      },
      {
        id: "capabilities",
        title: "Add bindings",
      },
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
      {
        id: "pages",
        title: "Make a page reachable",
      },
      {
        id: "matching",
        title: "Choose URL patterns and accepted input",
      },
      {
        id: "mount",
        title: "Group pages under shared UI",
      },
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
      {
        id: "boundary",
        title: "Decide where the behavior belongs",
      },
      {
        id: "server",
        title: "Extract a reusable server view",
      },
      {
        id: "client-boundary",
        title: "Add a control without moving the Page",
      },
    ],
    source: "/guide/components",
  },
  {
    slug: "/guide/server-functions",
    title: "Server Functions",
    description: "Build a form that validates input, calls a server service, and shows its result.",
    section: "Guides",
    headings: [
      {
        id: "identity",
        title: "Make the service available to the action",
      },
      {
        id: "state",
        title: "Return a greeting to the form",
      },
      {
        id: "application",
        title: "Run the complete round trip",
      },
      {
        id: "forms",
        title: "Use a direct action for side effects",
      },
      {
        id: "input",
        title: "Accept an object instead of FormData",
      },
      {
        id: "refresh",
        title: "Decide how updates and failures appear",
      },
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
      {
        id: "service",
        title: "Connect a dependency to a Page",
      },
      {
        id: "lifetime",
        title: "Extend usage while keeping request scope",
      },
      {
        id: "missing-services",
        title: "Resolve service wiring errors",
      },
    ],
    source: "/guide/effect",
  },
  {
    slug: "/guide/middleware",
    title: "Middleware",
    description: "Prepare request data and enforce checks for selected pages and Server Functions.",
    section: "Guides",
    headings: [
      {
        id: "reach",
        title: "Choose which requests to cover",
      },
      {
        id: "view",
        title: "Prepare a service for downstream work",
      },
      {
        id: "routes",
        title: "Display the service value on a page",
      },
      {
        id: "order",
        title: "Stop a request before its handler runs",
      },
      {
        id: "actions",
        title: "Apply the behavior to form submissions",
      },
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
      {
        id: "router",
        title: "Define the JSON endpoint",
      },
      {
        id: "services",
        title: "Register the endpoint and make a request",
      },
      {
        id: "boundary",
        title: "Keep service resources within the request",
      },
      {
        id: "global",
        title: "Add a header to Page and API responses",
      },
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
      {
        id: "setup",
        title: "Prepare your first article",
      },
      {
        id: "collection",
        title: "Make the article available to your Page",
      },
      {
        id: "render",
        title: "Publish the article and connect related pages",
      },
      {
        id: "authoring",
        title: "Keep the defaults or customize parsing",
      },
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
      {
        id: "setup",
        title: "Use Tailwind classes",
      },
      {
        id: "stylesheet",
        title: "Define shared theme values",
      },
      {
        id: "scope",
        title: "Extend styling with a plugin",
      },
    ],
    source: "/guide/styling",
  },
  {
    slug: "/advanced",
    title: "Runtime behavior",
    description: "Plan user feedback, navigation, and resource cleanup around asynchronous work.",
    section: "Guides",
    headings: [
      {
        id: "chapters",
        title: "Design around asynchronous work",
      },
    ],
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
      {
        id: "response-lifetime",
        title: "Let the response body determine when cleanup runs",
      },
      {
        id: "request-layer",
        title: "Register acquisition and release in the application Layer",
      },
      {
        id: "render-scope",
        title: "Use request services in pages and Server Functions",
      },
      {
        id: "resource-design",
        title: "Customize response handling without closing resources early",
      },
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
      {
        id: "native-navigation",
        title: "Keep shared controls outside the Page",
      },
      {
        id: "transition-scope",
        title: "Choose an animation for the changing content",
      },
      {
        id: "commit-and-stream",
        title: "Plan for content that arrives after navigation",
      },
      {
        id: "history-cache",
        title: "Account for back, forward, and full-page loads",
      },
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
      {
        id: "execution",
        title: "Build a save-and-refresh flow",
      },
      {
        id: "input-boundary",
        title: "Protect the write before exposing the form",
      },
      {
        id: "result-and-refresh",
        title: "Give feedback without waiting for the whole page",
      },
      {
        id: "concurrency",
        title: "Handle repeated saves safely",
      },
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
      {
        id: "pages",
        title: "Start with one user journey",
      },
      {
        id: "services",
        title: "Cover business rules without the browser",
      },
      {
        id: "production",
        title: "Check the release build in its target runtime",
      },
      {
        id: "tools",
        title: "Make the checks repeatable",
      },
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
      {
        id: "exports",
        title: "Public API map",
      },
      {
        id: "index",
        title: "Application factory index",
      },
      {
        id: "versions",
        title: "Dependency matrix",
      },
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
      {
        id: "example",
        title: "A one-route application",
      },
      {
        id: "identity",
        title: "Application.effront: create shared factories",
      },
      {
        id: "make",
        title: "EFFRONT.make: supply routes and services",
      },
      {
        id: "middleware",
        title: "EFFRONT.withMiddleware: extend selected definitions",
      },
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
      {
        id: "render",
        title: "Choose a rendering factory",
      },
      {
        id: "loading",
        title: "Add a shared layout and loading UI",
      },
      {
        id: "params",
        title: "Decode URL parameters for a Page",
      },
      {
        id: "view-transition",
        title: "Configure page transitions",
      },
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
      {
        id: "routes",
        title: "Register and compose routes",
      },
      {
        id: "paths",
        title: "Match paths to Page parameters",
      },
      {
        id: "middleware",
        title: "Apply Middleware to a route group",
      },
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
      {
        id: "make",
        title: "Define a callable operation",
      },
      {
        id: "arguments",
        title: "Match the signature to the caller",
      },
      {
        id: "execution",
        title: "Protect and reuse the operation",
      },
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
      {
        id: "fetch",
        title: "Connect an application with createFetchHandler",
      },
      {
        id: "readers",
        title: "Choose a core reader for the values you need",
      },
      {
        id: "cloudflare",
        title: "Use Cloudflare readers with an Env type",
      },
      {
        id: "context",
        title: "Inspect the shared WorkersRequestContext",
      },
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
      {
        id: "effront",
        title: "Enable Effront in Vite",
      },
      {
        id: "configuration",
        title: "Choose entry files",
      },
      {
        id: "cloudflare",
        title: "Configure Cloudflare Workers",
      },
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
      {
        id: "fetch",
        title: "Choose the host boundary",
      },
      {
        id: "handler",
        title: "Handle a request with toHttpEffect",
      },
      {
        id: "capture",
        title: "Capture host services with makeHttpEffect",
      },
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
      {
        id: "vite",
        title: "Vite entries: effrontServer",
      },
      {
        id: "serve",
        title: "Production listener: serve",
      },
      {
        id: "assets",
        title: "Static files: withAssets",
      },
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
      {
        id: "collection",
        title: "createMarkdownCollection: document lookup",
      },
      {
        id: "parse",
        title: "parseMarkdown: parsing and rendering",
      },
      {
        id: "references",
        title: "Resolving links and assets",
      },
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
      {
        id: "http",
        title: "Build a request handler",
      },
      {
        id: "vite",
        title: "Configure the Worker build",
      },
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
      {
        id: "plugin",
        title: "Enable Tailwind with effrontTailwind",
      },
      {
        id: "stylesheet",
        title: "Customize with stylesheet",
      },
    ],
    source: "/api-reference/tailwind",
  },
] as const satisfies readonly (Omit<DocPage, "content"> & { readonly source: string })[];
