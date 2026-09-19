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
        When you need to explain how a Page becomes a browser document, start by following one page
        load rather than reading every module in core. This chapter maps that path through{" "}
        <code>packages/core/src</code>, from a reusable application definition to request-scoped
        services and a streamed response. Use the map to locate the code behind routing, rendering,
        or browser behavior before opening the detailed chapters.
      </p>
      <h2 id="entries">Find the definition, request, and browser entrypoints</h2>
      <p>
        A page load connects three different entrypoints. Identifying which one you are reading
        prevents application construction from being mistaken for request execution or browser
        startup.
      </p>
      <ol>
        <li>
          <strong>Application definition.</strong> The default <code>src/entry.effront.tsx</code>{" "}
          exports the application. Vite exposes it through{" "}
          <code>@effront/core/application-entry</code>. In <code>application/definition.tsx</code>,{" "}
          <code>makeApplication</code> compiles Routes and retains the service Layer, but does not
          acquire those services.
        </li>
        <li>
          <strong>Request handling.</strong> The host entry connects that definition to HTTP. The
          native boundary is <code>@effront/core/http</code>, while <code>workers.ts</code> adapts
          it to a Workers-compatible Fetch handler. The portable Vite integration defaults its RSC
          entry to <code>src/entry.workers.ts</code>, and the host integration can select a
          different entry.
        </li>
        <li>
          <strong>Browser startup.</strong> Core's <code>client/entry.ts</code> runs{" "}
          <code>browserMain</code> through <code>BrowserRuntime.runMain</code>. It activates the
          browser against the rendered document rather than importing the application definition to
          run its server services there.
        </li>
      </ol>
      <h2 id="request-flow">Follow a request into a rendered document</h2>
      <p>
        Use the Fetch adapter as a small, concrete starting point. This excerpt from{" "}
        <code>createFetchHandler</code> shows a reusable Web handler receiving a fresh{" "}
        <code>WorkersRequestContext</code> on each call. The Context contains that call's{" "}
        <code>env</code>, <code>executionContext</code>, and <code>request</code>.
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
        Handler reuse does not mean application services are shared across requests. In{" "}
        <code>http.ts</code>, <code>toHttpEffect</code> creates a fresh Layer memo map for each
        evaluation and builds <code>ServerApplication.httpLayer(application)</code> in the current
        request Context. The application's Layer can therefore read the host values while acquiring
        services. Effront does not implicitly add those host values to Flight or HTML.
      </p>
      <ol>
        <li>
          <strong>Match a destination.</strong> <code>server/application.ts</code> registers the
          compiled route patterns with Effect HTTP and connects them to the application services and
          route middleware.
        </li>
        <li>
          <strong>Prepare the Page.</strong> For a GET with a parameter Schema, the handler decodes
          the matched parameters before rendering. A decoding failure returns 404. POST takes the
          separate Server Function preparation and execution path rather than this GET path.
        </li>
        <li>
          <strong>Render Flight.</strong> <code>renderRouteTree</code> builds the route tree, and{" "}
          <code>FlightRenderer</code> renders its React Flight representation.
        </li>
        <li>
          <strong>Select the response.</strong> An <code>Accept</code> header exactly equal to{" "}
          <code>FlightMediaType</code> selects the Flight stream. Otherwise,{" "}
          <code>HtmlRenderer</code> loads the SSR entry to turn that Flight stream into HTML.
        </li>
        <li>
          <strong>Activate the document.</strong> In <code>client/application.ts</code>, the browser
          loads the initial Flight payload, hydrates the document, and installs refresh and Server
          Function handling. It installs the client router only when <code>navigationMode</code> is{" "}
          <code>"Client"</code>.
        </li>
      </ol>
      <p>
        Returning response headers is not the end of rendering. The host must retain the request
        Scope until a streaming body ends, fails, or is cancelled. Effect HTTP's Web handler manages
        that lifetime transfer, while core removes the body for HEAD so an unread stream does not
        retain the Scope. If you use <code>makeHttpEffect</code> to capture external service
        references, their owner must also keep them alive through the response bodies that use them.
        Capturing a reference does not extend its lifetime or change the per-request construction of
        the application Layer. See{" "}
        <a href="/en/architecture/implementation/request">request processing</a> for the complete
        boundary.
      </p>
      <h2 id="responsibilities">Locate the code that owns each stage</h2>
      <p>
        With the page-load path in view, choose the source directory by the stage you need to
        understand. Paths below are relative to <code>packages/core/src</code> unless a package is
        named explicitly.
      </p>
      <ul>
        <li>
          <strong>What can this application serve?</strong> Read <code>application/</code> for
          definition identity, service contracts, and compilation of Routes into destinations.
        </li>
        <li>
          <strong>What runs for this request?</strong> Read <code>http.ts</code> and{" "}
          <code>server/application.ts</code> for Layer construction, HTTP dispatch, middleware, and
          response selection.
        </li>
        <li>
          <strong>What becomes renderable data?</strong> Read <code>rsc/</code> for the route-tree
          and Flight contracts, then the renderers in <code>server/</code> for Flight and HTML
          production.
        </li>
        <li>
          <strong>What happens after the document arrives?</strong> Read <code>client/</code> for
          hydration, navigation, refresh, and Server Function calls.
        </li>
      </ul>
      <p>
        If the question is instead where these modules execute, move to the integrations.{" "}
        <code>packages/vite/src/index.ts</code> configures the React/RSC plugins, application alias,
        and browser, RSC, and SSR entries. The Cloudflare adapter connects RSC and its child SSR
        environment to workerd, while <code>@effront/server</code> supplies native Node.js and Bun
        hosting with separate RSC and SSR graphs. These integrations arrange module execution and
        host connections, rather than defining the Page rendering pipeline above.
      </p>
      <h2 id="reading-order">Choose the next part of the trace</h2>
      <p>
        To follow the implementation from its inputs, continue with{" "}
        <a href="/en/architecture/implementation/application">application definitions</a> and{" "}
        <a href="/en/architecture/implementation/routing">route compilation</a>. They explain the
        reusable definition that request processing consumes. Then read{" "}
        <a href="/en/architecture/implementation/request">request processing</a> and{" "}
        <a href="/en/architecture/implementation/rendering">rendering</a> to follow service
        acquisition through response production.
      </p>
      <p>
        If the initial document already works and you are investigating a later interaction, start
        with <a href="/en/architecture/implementation/navigation">navigation</a> or{" "}
        <a href="/en/architecture/implementation/server-functions">Server Functions</a>. Across
        these chapters, keep three things distinct: the reusable definition, the services owned by a
        request, and the data sent to the browser. That distinction lets you follow a value without
        assuming that crossing a rendering boundary also transfers its lifetime or its server
        dependencies.
      </p>
    </>
  ),
};
