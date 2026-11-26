import type { ArticleMetadata } from "#docs/content/article-metadata.ts";

export const onboardingArticles = [
  {
    description:
      "A React meta-framework built on Effect, with server-rendered pages, typed services, and Server Functions.",
    headings: [
      { id: "boundaries", title: "Get a page on screen" },
      { id: "overview", title: "Add data and user actions" },
      { id: "next", title: "Choose your next guide" },
    ],
    section: "Getting started",
    slug: "/",
    source: "/index",
    title: "Effront",
  },
  {
    description: "Display Hello, world with your first Effront application.",
    headings: [
      { id: "setup", title: "Run the sample" },
      { id: "application", title: "Explore the sample" },
      { id: "run", title: "Change the heading" },
    ],
    section: "Getting started",
    slug: "/guide/getting-started",
    source: "/guide/getting-started",
    title: "Getting started",
  },
  {
    description: "Set up development and production environments for your deployment target.",
    headings: [{ id: "support", title: "Choose your hosting model" }],
    section: "Platforms",
    slug: "/platforms",
    source: "/platforms",
    title: "Deployment platforms",
  },
  {
    description:
      "A guide to setting up development and production environments for Cloudflare Workers.",
    headings: [
      { id: "setup", title: "Run the example" },
      { id: "vite", title: "Find the Worker configuration" },
      { id: "local", title: "Run the built Worker with Wrangler" },
      { id: "context", title: "Read Worker bindings and request context" },
      { id: "alchemy", title: "Manage resources with Alchemy" },
    ],
    section: "Platforms",
    slug: "/platforms/cloudflare",
    source: "/platforms/cloudflare",
    title: "Cloudflare Workers",
  },
  {
    description:
      "Run the Node.js example in development, then build and start its production server.",
    headings: [
      { id: "setup", title: "Run the example" },
      { id: "entries", title: "Find the application and server files" },
      { id: "assets", title: "Check the production build locally" },
      { id: "node", title: "Start the Node.js server" },
    ],
    section: "Platforms",
    slug: "/platforms/node",
    source: "/platforms/node",
    title: "Node.js",
  },
  {
    description: "Run the Bun example in development, then build and start its production server.",
    headings: [
      { id: "setup", title: "Run the example" },
      { id: "entries", title: "Find the application and server files" },
      { id: "assets", title: "Check the production build locally" },
      { id: "bun", title: "Start the Bun server" },
    ],
    section: "Platforms",
    slug: "/platforms/bun",
    source: "/platforms/bun",
    title: "Bun",
  },
  {
    description: "A guide to setting up a Cloudflare Workers development environment with Alchemy.",
    headings: [
      { id: "setup", title: "Prepare the example" },
      { id: "worker", title: "Find the application and resource definitions" },
      { id: "stack", title: "Start development" },
      { id: "capabilities", title: "Add resources when needed" },
    ],
    section: "Platforms",
    slug: "/platforms/alchemy",
    source: "/platforms/alchemy",
    title: "Alchemy and Cloudflare",
  },
] as const satisfies Readonly<ArticleMetadata[]>;
