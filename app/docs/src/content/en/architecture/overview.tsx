import type { ReactNode } from "react";

import { renderArticleList } from "#docs/content/core-article-list.tsx";
import { coreModelSources } from "#docs/content/core-model.tsx";
import { SourceExcerpt } from "#docs/content/core-source.tsx";
import type { DocPage } from "#docs/content/types.ts";

const renderIntroduction = (): ReactNode => (
  <p>
    A page load connects a reusable application definition, request-owned services, and data sent to
    the browser. These have different lifetimes. Route compilation does not acquire services. Flight
    rendering does not transfer the server&apos;s Context to the client.
  </p>
);

const renderEntriesList = (): ReactNode =>
  renderArticleList("ol", [
    {
      content: (
        <>
          <strong>Definition:</strong> the default entry, <code>src/entry.effront.tsx</code>,
          supplies the application as its default export. Vite exposes it as{" "}
          <code>@effront/core/application-entry</code>. <code>makeApplication</code> in{" "}
          <code>application/definition.tsx</code> compiles Routes and stores the service Layer
          without building it.
        </>
      ),
      id: "definition",
    },
    {
      content: (
        <>
          <strong>Request:</strong> the host connects the definition to{" "}
          <code>@effront/core/http</code>. <code>workers.ts</code> adapts this native Effect HTTP
          boundary to Fetch. The portable Vite integration defaults its RSC entry to{" "}
          <code>src/entry.workers.ts</code>, unless the host integration selects another entry.
        </>
      ),
      id: "request",
    },
    {
      content: (
        <>
          <strong>Browser:</strong> <code>client/entry.ts</code> runs <code>browserMain</code>{" "}
          through <code>BrowserRuntime.runMain</code>. It hydrates the document from Flight, not by
          importing the application&apos;s server services.
        </>
      ),
      id: "browser",
    },
  ]);

const renderEntries = (): ReactNode => (
  <>
    <h2 id="entries">Find the definition, request, and browser entrypoints</h2>
    {renderEntriesList()}
  </>
);

const requestFlowStages = [
  {
    content: (
      <>
        <strong>Match:</strong> <code>server/application.ts</code> registers compiled destinations
        with Effect HTTP and attaches their services and middleware.
      </>
    ),
    id: "matching",
  },
  {
    content: (
      <>
        <strong>Validate:</strong> a GET to a parameterized Page decodes its matched parameters
        before rendering. A Schema decoding failure returns 404. POST instead prepares and executes
        a Server Function.
      </>
    ),
    id: "validation",
  },
  {
    content: (
      <>
        <strong>Render:</strong> <code>renderRouteTree</code> builds the route tree and{" "}
        <code>FlightRenderer</code> produces its React Flight stream.
      </>
    ),
    id: "rendering",
  },
  {
    content: (
      <>
        <strong>Respond:</strong> an <code>Accept</code> header exactly equal to{" "}
        <code>FlightMediaType</code> selects Flight. Otherwise, <code>HtmlRenderer</code> loads the
        SSR entry to turn the same stream into HTML.
      </>
    ),
    id: "response",
  },
  {
    content: (
      <>
        <strong>Hydrate:</strong> <code>client/application.ts</code> loads the initial Flight
        payload, hydrates the document, and installs refresh and Server Function handling. It
        installs the client router only when <code>navigationMode</code> is{" "}
        <code>&quot;Client&quot;</code>.
      </>
    ),
    id: "hydration",
  },
];

const renderRequestFlow = (): ReactNode => (
  <>
    <h2 id="request-flow">Follow a request into a rendered document</h2>
    <p>
      <code>createFetchHandler</code> reuses a Web handler but supplies a fresh{" "}
      <code>WorkersRequestContext</code> on every call:
    </p>
    <SourceExcerpt locale="en" source={coreModelSources.fetchBoundary} />
    <p>
      In <code>http.ts</code>, each evaluation of <code>toHttpEffect</code> creates a fresh Layer
      memo map and builds <code>ServerApplication.httpLayer(application)</code> in the current
      request Context. The application Layer can read that request&apos;s host values during
      acquisition. Handler reuse therefore does not share application service instances across
      requests.
    </p>
    {renderArticleList("ol", requestFlowStages)}
    <p>
      Response headers can arrive before rendering finishes. Effect HTTP&apos;s Web handler keeps
      the request Scope alive until a streaming body ends, fails, or is canceled. Core removes HEAD
      bodies before that transfer so unread streams cannot retain the Scope. Services borrowed
      through <code>makeHttpEffect</code> remain owned by the host, which must keep them alive
      through all response bodies that use them. Refer to{" "}
      <a href="/en/architecture/implementation/request">request processing</a> for these ownership
      boundaries.
    </p>
  </>
);

const renderResponsibilitiesList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <code>application/</code>: definition identity, service contracts, and route compilation.
        </>
      ),
      id: "definition",
    },
    {
      content: (
        <>
          <code>http.ts</code> and <code>server/application.ts</code>: request acquisition, HTTP
          dispatch, middleware, and response selection.
        </>
      ),
      id: "server",
    },
    {
      content: (
        <>
          <code>rsc/</code> and the renderers in <code>server/</code>: route-tree contracts, Flight
          production, and HTML rendering.
        </>
      ),
      id: "rendering",
    },
    {
      content: (
        <>
          <code>client/</code>: hydration, navigation, refresh, and Server Function calls.
        </>
      ),
      id: "browser",
    },
  ]);

const renderResponsibilities = (): ReactNode => (
  <>
    <h2 id="responsibilities">Locate the code that owns each stage</h2>
    <p>
      Paths below are relative to <code>packages/core/src</code>:
    </p>
    {renderResponsibilitiesList()}
    <p>
      Execution environments belong to the integrations. <code>packages/vite/src/plugin.ts</code>{" "}
      configures React/RSC plugins, the application alias, and browser, RSC, and SSR entries. The
      Cloudflare adapter runs RSC and its child SSR environment in workerd.{" "}
      <code>@effront/server</code> hosts separate RSC and SSR graphs in Node.js or Bun.
    </p>
  </>
);

const renderReadingOrderList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <strong>Before a request:</strong>{" "}
          <a href="/en/architecture/implementation/application">application definitions</a> and{" "}
          <a href="/en/architecture/implementation/routing">route compilation</a> explain what the
          reusable definition retains.
        </>
      ),
      id: "before-request",
    },
    {
      content: (
        <>
          <strong>During a request:</strong>{" "}
          <a href="/en/architecture/implementation/request">request processing</a> and{" "}
          <a href="/en/architecture/implementation/rendering">rendering</a> connect service
          acquisition to the response body.
        </>
      ),
      id: "during-request",
    },
    {
      content: (
        <>
          <strong>After hydration:</strong>{" "}
          <a href="/en/architecture/implementation/navigation">navigation</a> and{" "}
          <a href="/en/architecture/implementation/server-functions">Server Functions</a> coordinate
          new Flight data with the visible UI.
        </>
      ),
      id: "after-hydration",
    },
  ]);

const renderReadingOrder = (): ReactNode => (
  <>
    <h2 id="reading-order">Choose the next part of the trace</h2>
    {renderReadingOrderList()}
  </>
);

const renderArticle = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderEntries()}
    {renderRequestFlow()}
    {renderResponsibilities()}
    {renderReadingOrder()}
  </>
);

export const page = {
  content: renderArticle,
  description:
    "An implementation map from application definitions to pages displayed in the browser.",
  group: "Implementation",
  headings: [
    { id: "entries", title: "Find the definition, request, and browser entrypoints" },
    { id: "request-flow", title: "Follow a request into a rendered document" },
    { id: "responsibilities", title: "Locate the code that owns each stage" },
    { id: "reading-order", title: "Choose the next part of the trace" },
  ],
  section: "Architecture",
  slug: "/architecture/implementation/overview",
  title: "01. Trace a page load through core",
} satisfies DocPage;
