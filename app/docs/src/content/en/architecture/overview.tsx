import { CodeBlock } from "../../../components/code-block";
import { coreModelSources } from "../../core-model";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/overview",
  title: "01. Trace a page load through core",
  description:
    "Follow an application definition through request handling, Flight, HTML, and hydration to find the implementation responsible for each stage.",
  section: "Architecture",
  group: "Implementation",
  headings: [
    { id: "entries", title: "Find the definition, request, and browser entrypoints" },
    { id: "request-flow", title: "Follow a request into a rendered document" },
    { id: "responsibilities", title: "Locate the code that owns each stage" },
    { id: "reading-order", title: "Choose the next part of the trace" },
  ],
  content: () => (
    <>
      <p>
        A page load connects a reusable application definition, request-owned services, and data
        sent to the browser. These have different lifetimes: compiling Routes does not acquire
        services, and rendering Flight does not transfer the server's Context to the client.
      </p>
      <h2 id="entries">Find the definition, request, and browser entrypoints</h2>
      <ol>
        <li>
          <strong>Definition:</strong> the default entry, <code>src/entry.effront.tsx</code>,
          provides the application as its default export. Vite exposes it as{" "}
          <code>@effront/core/application-entry</code>. <code>makeApplication</code> in{" "}
          <code>application/definition.tsx</code> compiles Routes and stores the service Layer
          without building it.
        </li>
        <li>
          <strong>Request:</strong> the host connects the definition to{" "}
          <code>@effront/core/http</code>. <code>workers.ts</code> adapts this native Effect HTTP
          boundary to Fetch. The portable Vite integration defaults its RSC entry to{" "}
          <code>src/entry.workers.ts</code>, unless the host integration selects another entry.
        </li>
        <li>
          <strong>Browser:</strong> <code>client/entry.ts</code> runs <code>browserMain</code>{" "}
          through <code>BrowserRuntime.runMain</code>. It hydrates the document from Flight, not by
          importing the application's server services.
        </li>
      </ol>
      <h2 id="request-flow">Follow a request into a rendered document</h2>
      <p>
        <code>createFetchHandler</code> reuses a Web handler but supplies a fresh{" "}
        <code>WorkersRequestContext</code> on every call:
      </p>
      <figure data-core-source={coreModelSources.fetchBoundary.path}>
        <figcaption>
          Excerpt from <code>{coreModelSources.fetchBoundary.path}</code>
        </figcaption>
        <CodeBlock
          code={coreModelSources.fetchBoundary.code}
          language={coreModelSources.fetchBoundary.language}
        />
      </figure>
      <p>
        In <code>http.ts</code>, each evaluation of <code>toHttpEffect</code> creates a fresh Layer
        memo map and builds <code>ServerApplication.httpLayer(application)</code> in the current
        request Context. The application Layer can read that request's host values during
        acquisition. Handler reuse therefore does not share application service instances across
        requests.
      </p>
      <ol>
        <li>
          <strong>Match:</strong> <code>server/application.ts</code> registers compiled destinations
          with Effect HTTP and attaches their services and middleware.
        </li>
        <li>
          <strong>Validate:</strong> a GET to a parameterized Page decodes its matched parameters
          before rendering. A Schema decoding failure returns 404. POST instead prepares and
          executes a Server Function.
        </li>
        <li>
          <strong>Render:</strong> <code>renderRouteTree</code> builds the route tree and{" "}
          <code>FlightRenderer</code> produces its React Flight stream.
        </li>
        <li>
          <strong>Respond:</strong> an <code>Accept</code> header exactly equal to{" "}
          <code>FlightMediaType</code> selects Flight. Otherwise, <code>HtmlRenderer</code> loads
          the SSR entry to turn the same stream into HTML.
        </li>
        <li>
          <strong>Hydrate:</strong> <code>client/application.ts</code> loads the initial Flight
          payload, hydrates the document, and installs refresh and Server Function handling. It
          installs the client router only when <code>navigationMode</code> is <code>"Client"</code>.
        </li>
      </ol>
      <p>
        Response headers can arrive before rendering finishes. Effect HTTP's Web handler keeps the
        request Scope alive until a streaming body ends, fails, or is cancelled. Core removes HEAD
        bodies before that transfer so unread streams cannot retain the Scope. Services borrowed
        through <code>makeHttpEffect</code> remain owned by the host, which must keep them alive
        through all response bodies that use them. See{" "}
        <a href="/en/architecture/implementation/request">request processing</a> for these ownership
        boundaries.
      </p>
      <h2 id="responsibilities">Locate the code that owns each stage</h2>
      <p>
        Paths below are relative to <code>packages/core/src</code>:
      </p>
      <ul>
        <li>
          <code>application/</code>: definition identity, service contracts, and route compilation.
        </li>
        <li>
          <code>http.ts</code> and <code>server/application.ts</code>: request acquisition, HTTP
          dispatch, middleware, and response selection.
        </li>
        <li>
          <code>rsc/</code> and the renderers in <code>server/</code>: route-tree contracts, Flight
          production, and HTML rendering.
        </li>
        <li>
          <code>client/</code>: hydration, navigation, refresh, and Server Function calls.
        </li>
      </ul>
      <p>
        Execution environments belong to the integrations. <code>packages/vite/src/index.ts</code>{" "}
        configures React/RSC plugins, the application alias, and browser, RSC, and SSR entries. The
        Cloudflare adapter runs RSC and its child SSR environment in workerd.{" "}
        <code>@effront/server</code> hosts separate RSC and SSR graphs in Node.js or Bun.
      </p>
      <h2 id="reading-order">Choose the next part of the trace</h2>
      <ul>
        <li>
          <strong>Before a request:</strong>{" "}
          <a href="/en/architecture/implementation/application">application definitions</a> and{" "}
          <a href="/en/architecture/implementation/routing">route compilation</a> explain what the
          reusable definition retains.
        </li>
        <li>
          <strong>During a request:</strong>{" "}
          <a href="/en/architecture/implementation/request">request processing</a> and{" "}
          <a href="/en/architecture/implementation/rendering">rendering</a> connect service
          acquisition to the response body.
        </li>
        <li>
          <strong>After hydration:</strong>{" "}
          <a href="/en/architecture/implementation/navigation">navigation</a> and{" "}
          <a href="/en/architecture/implementation/server-functions">Server Functions</a> coordinate
          new Flight data with the visible UI.
        </li>
      </ul>
    </>
  ),
};
