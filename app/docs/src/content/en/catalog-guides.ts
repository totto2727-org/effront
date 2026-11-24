import type { ArticleMetadata } from "#docs/content/article-metadata.ts";

export const guideArticles = [
  {
    description: "A guide to building pages and shared layouts and connecting them to URLs.",
    headings: [
      { id: "layouts", title: "Define the shared Layout" },
      { id: "pages", title: "Define the Page content" },
      { id: "routes", title: "Connect the Layout and Page with Routes" },
      { id: "application", title: "Run the complete application entry" },
      { id: "matching", title: "Read path parameters" },
      { id: "mount", title: "Add a section layout and loading UI" },
    ],
    section: "Guides",
    slug: "/guide/routes",
    source: "/guide/routes",
    title: "Pages, layouts, and routes",
  },
  {
    description:
      "Keep data access on the server while adding reusable UI and interactive controls.",
    headings: [
      { id: "boundary", title: "Choose a component for the task" },
      { id: "server", title: "Reuse server-rendered UI" },
      { id: "client-boundary", title: "Add an interactive control" },
    ],
    section: "Guides",
    slug: "/guide/components",
    source: "/guide/components",
    title: "Server and Client Components",
  },
  {
    description: "Choose between mutation, query, and stream Server Function calls.",
    headings: [{ id: "choose", title: "Choose a call" }],
    section: "Guides",
    slug: "/guide/server-functions",
    source: "/guide/server-functions",
    title: "Server Functions",
  },
  {
    description: "Submit forms and render the current route after a server-side change.",
    headings: [
      { id: "identity", title: "Share the application definition" },
      { id: "forms", title: "Submit a form directly" },
      { id: "application", title: "Render and submit the form" },
      { id: "state", title: "Add form state with useActionState" },
      { id: "input", title: "Accept an object argument" },
      { id: "refresh", title: "Handle updates" },
      { id: "errors", title: "Handle failures" },
    ],
    section: "Guides",
    slug: "/guide/mutation-server-functions",
    source: "/guide/mutation-server-functions",
    title: "Mutation Server Functions",
  },
  {
    description:
      "Read one server value from a Client Component without refreshing the current route.",
    headings: [
      { id: "call", title: "Call a query" },
      { id: "atom", title: "Keep a reactive result" },
      { id: "atom-setup", title: "Set up optional atom integration" },
    ],
    section: "Guides",
    slug: "/guide/query-server-functions",
    source: "/guide/query-server-functions",
    title: "Query Server Functions",
  },
  {
    description:
      "Render progressive server results without turning the read into a route-refreshing mutation.",
    headings: [
      { id: "feed", title: "Stream a feed" },
      { id: "render", title: "Render arriving stories" },
    ],
    section: "Guides",
    slug: "/guide/stream-server-functions",
    source: "/guide/stream-server-functions",
    title: "Stream Server Functions",
  },
  {
    description: "A guide to structuring application logic and dependencies with Effect services.",
    headings: [
      { id: "service", title: "Use a service in a Page" },
      { id: "lifetime", title: "Choose the service scope" },
      { id: "missing-services", title: "Fix missing-service errors" },
    ],
    section: "Guides",
    slug: "/guide/effect",
    source: "/guide/effect",
    title: "Application services",
  },
  {
    description:
      "A guide to sharing request handling, such as authentication, across pages and Server Functions.",
    headings: [
      { id: "reach", title: "Choose the request scope" },
      { id: "view", title: "Provide a request service" },
      { id: "routes", title: "Apply the service to a Page" },
      { id: "order", title: "Return an early response" },
      { id: "actions", title: "Apply checks to a Server Function" },
    ],
    section: "Guides",
    slug: "/guide/middleware",
    source: "/guide/middleware",
    title: "Middleware",
  },
  {
    description: "A guide to adding HTTP APIs alongside your application pages.",
    headings: [
      { id: "router", title: "Define a JSON endpoint" },
      { id: "services", title: "Register the route and its service" },
      { id: "boundary", title: "Keep resources request-local" },
      { id: "global", title: "Add a shared response header" },
    ],
    section: "Guides",
    slug: "/guide/http",
    source: "/guide/http",
    title: "HTTP endpoints",
  },
  {
    description: "A guide to publishing Markdown content as Effront pages.",
    headings: [
      { id: "setup", title: "Add an article" },
      { id: "collection", title: "Load the collection" },
      { id: "render", title: "Render the article at its URL" },
      { id: "authoring", title: "Customize parsing or rendering" },
    ],
    section: "Guides",
    slug: "/guide/markdown",
    source: "/guide/markdown",
    title: "Writing pages in Markdown",
  },
  {
    description: "A guide to styling Effront applications with Tailwind CSS.",
    headings: [
      { id: "setup", title: "Add Tailwind utilities" },
      { id: "stylesheet", title: "Define a theme in a stylesheet" },
      { id: "scope", title: "Add an optional Tailwind plugin" },
    ],
    section: "Guides",
    slug: "/guide/styling",
    source: "/guide/styling",
    title: "Styling with Tailwind",
  },
  {
    description: "Use links, preserve shared Layout state, and configure Page animations.",
    headings: [
      { id: "native-navigation", title: "Follow ordinary links" },
      { id: "transition-scope", title: "Turn off a Page's animation" },
      { id: "global-config", title: "Turn off animations across the application" },
      { id: "commit-and-stream", title: "Keep loading UI visible until content arrives" },
      { id: "history-cache", title: "Back, Forward, and reload" },
    ],
    section: "Guides",
    slug: "/advanced/client-navigation",
    source: "/advanced/client-navigation",
    title: "Client navigation",
  },
  {
    description: "How Server Function results and page updates relate to each other.",
    headings: [
      { id: "execution", title: "One call returns a result and a refreshed page" },
      { id: "result-and-refresh", title: "The result can arrive before the view" },
      { id: "concurrency", title: "Refresh ordering is not write ordering" },
    ],
    section: "Guides",
    slug: "/advanced/server-function-execution-and-refresh",
    source: "/advanced/server-function-execution-and-refresh",
    title: "Server Function results and refresh",
  },
  {
    description:
      "Apply authentication and authorization to Routes and Server Functions with a shared middleware policy.",
    headings: [
      { id: "entry-points", title: "Apply checks at each entry point" },
      { id: "shared-policy", title: "Share one policy across both registrations" },
      { id: "authorization", title: "Authorize each operation" },
    ],
    section: "Best practices",
    slug: "/best-practices/authentication-and-authorization",
    source: "/best-practices/authentication-and-authorization",
    title: "Authentication and authorization",
  },
  {
    description:
      "Return expected outcomes as data and show safe messages for Server Function failures.",
    headings: [
      { id: "expected", title: "Return expected outcomes as data" },
      { id: "operational", title: "Show safe failure messages" },
    ],
    section: "Best practices",
    slug: "/best-practices/server-function-error-handling",
    source: "/best-practices/server-function-error-handling",
    title: "Error handling for Server Functions",
  },
  {
    description:
      "Choose owners for request, shared, and background-work resources, with cleanup timed to their use.",
    headings: [
      { id: "resource-design", title: "Choose the resource owner" },
      { id: "request-layer", title: "Acquire request resources in the application Layer" },
      { id: "response-lifetime", title: "Keep resources alive through the response body" },
    ],
    section: "Best practices",
    slug: "/advanced/request-runtime-and-lifetimes",
    source: "/advanced/request-runtime-and-lifetimes",
    title: "Manage service lifetimes",
  },
  {
    description:
      "Runnable Playwright examples for testing Route, Page, Layout, and Server Function behavior.",
    headings: [
      { id: "tools", title: "Use the runnable example" },
      { id: "routes", title: "Test Route responses" },
      { id: "pages", title: "Test Page output and hydration" },
      { id: "layouts", title: "Test Layout retention across navigation" },
      { id: "server-functions", title: "Test a Server Function through its client" },
    ],
    section: "Best practices",
    slug: "/best-practices/testing",
    source: "/best-practices/testing",
    title: "Testing your application",
  },
] as const satisfies Readonly<ArticleMetadata[]>;
