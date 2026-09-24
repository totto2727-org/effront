import { CodeBlock } from "../../../components/code-block";
import { coreRuntimeSources } from "../../core-runtime";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/rendering",
  title: "05. From a route to HTML and Flight",
  description: "How Effront renders an application into HTML and React Server Component payloads.",
  section: "Architecture",
  group: "Implementation",
  headings: [
    { id: "ssr-branch", title: "One render, two response formats" },
    { id: "route-to-flight", title: "Build the shared Flight payload" },
    { id: "render-runtime", title: "Keep asynchronous rendering inside the request" },
    { id: "html-eof", title: "Deliver Flight without breaking the HTML stream" },
  ],
  content: () => (
    <>
      <p>
        Document requests and client navigation share one Page rendering path. Both start with a
        React Flight stream: navigation consumes it directly, while SSR decodes it into HTML and
        embeds a copy for hydration.
      </p>
      <h2 id="ssr-branch">One render, two response formats</h2>
      <p>
        After routing and{" "}
        <a href="/en/architecture/implementation/request">request-service acquisition</a>,{" "}
        <code>render</code> in <code>packages/core/src/server/application.ts</code> calls{" "}
        <code>FlightRenderer</code>. It returns Flight only when Accept is exactly{" "}
        <code>text/x-component</code>. Every other value selects HTML, including Accept lists
        containing that media type.
      </p>
      <p>
        <code>HtmlRenderer</code> loads the SSR environment through{" "}
        <code>import.meta.viteRsc.loadModule("ssr", "index")</code>. In <code>server/ssr.tsx</code>,{" "}
        <code>tee()</code> splits Flight into two branches:
      </p>
      <ul>
        <li>
          <strong>SSR:</strong> <code>@vitejs/plugin-rsc/ssr</code> decodes the payload, then{" "}
          <code>react-dom/server.edge</code> renders its <code>RouteTree</code> to HTML.
        </li>
        <li>
          <strong>Browser:</strong> Flight bytes are embedded in the HTML for hydration.
        </li>
      </ul>
      <p>
        SSR consumes the RSC result rather than running the Page's server render Effect again. It
        also receives form state, a request-scoped abort signal, and a bootstrap script that imports
        the client entry. Both formats use <code>Cache-Control: private, no-store</code>. GET and
        POST pre-response handlers preserve existing Vary fields and add Accept unless Accept or{" "}
        <code>*</code> is already present.
      </p>
      <h2 id="route-to-flight">Build the shared Flight payload</h2>
      <p>
        <code>renderRouteTree</code> in <code>rsc/render-route-tree.tsx</code> starts with the
        matched Page and walks destination scopes from inner to outer, adding Loading boundaries and
        Layouts. It produces a <code>RouteTreeModel</code> with <code>id</code>,{" "}
        <code>content</code>, and <code>child</code>, not HTML. Layout IDs use scope identity. Page
        and Loading IDs also include the pathname.
      </p>
      <p>
        For non-POST requests, a Page parameter Schema decodes{" "}
        <a href="/en/architecture/implementation/routing">route parameters</a> before tree
        construction. Failure returns an empty 404 without starting Flight rendering. POST passes
        encoded parameters to the Page instead, so prevalidation is not universal.
      </p>
      <p>
        <code>FlightPayload</code> in <code>rsc/flight.ts</code> contains <code>routeTree</code>,{" "}
        <code>formState</code>, and <code>serverFnResult</code>. <code>FlightRenderer</code> passes
        it to <code>renderToReadableStream</code> from <code>@vitejs/plugin-rsc/rsc/server</code>,
        with temporary references as an option when supplied. The payload carries rendered data and
        action state, not an automatic copy of the service Context.
      </p>
      <h2 id="render-runtime">Keep asynchronous rendering inside the request</h2>
      <p>
        React may continue invoking Page, Layout, or Component Effects after returning a readable
        stream. <code>FlightRenderer</code> gives that work a child Scope and returns its release
        operation alongside the stream and abort signal:
      </p>
      <figure data-core-source={coreRuntimeSources.flightRuntime.path}>
        <figcaption>
          Excerpt from <code>{coreRuntimeSources.flightRuntime.path}</code>
        </figcaption>
        <CodeBlock
          code={coreRuntimeSources.flightRuntime.code}
          language={coreRuntimeSources.flightRuntime.language}
        />
      </figure>
      <p>
        <code>FiberSet.makeRuntimePromise</code> supplies the Promise-based Effect runner, with
        fibers owned by <code>renderScope</code>. <code>renderRuntime.bind</code> in{" "}
        <code>application/render-runtime.ts</code> stores that runner and active middleware in
        AsyncLocalStorage. Each definition's <code>run</code> call requires both the binding and
        every middleware scope it declared. Missing either throws <code>TypeError</code>, enforcing
        the{" "}
        <a href="/en/architecture/implementation/application">
          definition's service and scope contract
        </a>{" "}
        at runtime.
      </p>
      <p>
        <code>server/application.ts</code> attaches <code>Stream.ensuring(flight.release)</code> to
        both response formats and releases Flight if HTML startup fails. Flight startup failure also
        closes the child Scope. React errors are logged through the runner unless its signal is
        aborted. HTML loading or startup failures become <code>HtmlRenderError</code>, while later
        failures propagate through the response body.
      </p>
      <h2 id="html-eof">Deliver Flight without breaking the HTML stream</h2>
      <p>
        HTML chunks can end inside tags or other syntax, so inserting Flight scripts at arbitrary
        chunk boundaries could corrupt the document. <code>server/flight-html-stream.ts</code>{" "}
        instead waits for HTML EOF:
      </p>
      <figure data-core-source={coreRuntimeSources.htmlEof.path}>
        <figcaption>
          Excerpt from <code>{coreRuntimeSources.htmlEof.path}</code>
        </figcaption>
        <CodeBlock
          code={coreRuntimeSources.htmlEof.code}
          language={coreRuntimeSources.htmlEof.language}
        />
      </figure>
      <p>
        <code>makeHtmlWriter</code> forwards markup while retaining a possible final{" "}
        <code>{"</body></html>"}</code> trailer. At EOF it writes Flight scripts, then the closing
        tags. HTML still streams because SSR keeps consuming Flight, but the browser branch queues
        until insertion. Embedded Flight is not delivered incrementally beside each HTML chunk.
      </p>
      <p>
        Each Flight chunk is independently decoded with a fatal UTF-8 decoder. Invalid or incomplete
        UTF-8 falls back to base64 and reconstructs a <code>Uint8Array</code> in the browser. Inline
        scripts escape <code>{"</script"}</code> and <code>{"<!--"}</code> sequences.{" "}
        <code>client/initial-flight-stream.ts</code> converts strings in{" "}
        <code>self.__FLIGHT_DATA</code> back to bytes and forwards byte arrays unchanged. It closes
        at DOMContentLoaded, or immediately if the document is ready, supplying the stream for{" "}
        <a href="/en/architecture/implementation/navigation">hydration</a>.
      </p>
      <p>
        Cancellation first cancels the Flight reader and releases its lock, then cancels the HTML
        reader. It does not await the Flight tee branch's cancellation Promise, which may wait for a
        sibling that itself needs the request's abort signal. Read and flush errors reach the stream
        controller so the{" "}
        <a href="/en/architecture/implementation/request#response-lifetime">response-body owner</a>{" "}
        can finish cleanup.
      </p>
    </>
  ),
};
