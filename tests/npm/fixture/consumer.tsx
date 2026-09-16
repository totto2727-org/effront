import { effrontCloudflare } from "@effront/cloudflare";
import {
  createWorkersContextAccessors as createCloudflareAccessors,
  type CloudflareExecutionContext,
} from "@effront/cloudflare/workers";
import {
  createMarkdownCollection,
  type MarkdownCollection,
  type MarkdownEntry,
  MarkdownError,
  parseMarkdown,
} from "@effront/markdown";
import { effront } from "@effront/vite";
import { Application } from "effront";
import { createFetchHandler, createWorkersContextAccessors } from "effront/workers";
import { Effect } from "effect";
import type { PluginOption } from "vite";

const App = Application.effront();
const Layout = App.Layout.make({ render: ({ children }) => Effect.succeed(children) });
const Page = App.Page.make({ render: () => Effect.die("typecheck only") });
const application = App.make({
  routes: App.Routes.make({ layout: Layout }).page("/", Page),
});
const handler = createFetchHandler(application);
// @ts-expect-error Fetch handlers require an Application definition.
createFetchHandler({});

const workers = createWorkersContextAccessors<{ readonly API_ORIGIN: string }>();
const workerEnvironment: Effect.Effect<{ readonly API_ORIGIN: string }> = workers.getWorkersEnv();
const workerContext = workers.getWorkersRequestContext();
// @ts-expect-error Typed Workers environment bindings do not widen to incompatible values.
const invalidWorkerEnvironment: Effect.Effect<{ readonly API_ORIGIN: number }> =
  workers.getWorkersEnv();

const cloudflareWorkers = createCloudflareAccessors<{ readonly ASSETS: string }>();
const cloudflareEnvironment: Effect.Effect<{ readonly ASSETS: string }> =
  cloudflareWorkers.getWorkersEnv();
const cloudflareContext: CloudflareExecutionContext = {
  waitUntil: (_promise) => undefined,
};

const vitePlugins: PluginOption[] = effront({
  application: "src/application.tsx",
  rsc: "src/entry.workers.ts",
});
const cloudflarePlugins: PluginOption[] = effrontCloudflare();

const collection: Effect.Effect<MarkdownCollection, MarkdownError> = createMarkdownCollection({
  basePath: "/guide",
  documents: { "./getting-started.md": "# Getting started" },
});
declare const entry: MarkdownEntry;
const document = parseMarkdown(entry);

// @ts-expect-error Markdown collection prefixes are pathnames.
createMarkdownCollection({ basePath: 1, documents: {} });
const invalidCloudflareContext: CloudflareExecutionContext = {
  // @ts-expect-error Cloudflare contexts only accept Promise values for waitUntil.
  waitUntil: (_promise: string) => {},
};

void handler;
void workerEnvironment;
void workerContext;
void invalidWorkerEnvironment;
void cloudflareEnvironment;
void cloudflareContext;
void vitePlugins;
void cloudflarePlugins;
void collection;
void document;
void invalidCloudflareContext;

void vitePlugins;
void cloudflarePlugins;
void collection;
void document;
void invalidCloudflareContext;
