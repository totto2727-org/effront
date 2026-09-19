import { CodeBlock } from "../../../components/code-block";
import { coreRuntimeSources } from "../../core-runtime";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/rendering",
  title: "05. From a route to HTML and Flight",
  description:
    "Trace how one route render serves HTML and Flight responses, keeps request services available, and carries the initial payload to the browser.",
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
        A document request needs HTML to display, while an in-app navigation needs a new React route
        tree. Effront serves both from a Flight render rather than maintaining separate Page
        implementations. This chapter follows that shared path, so you can locate the boundary
        responsible for an unexpected response format, an unavailable rendering service, or a stream
        that does not finish.
      </p>
      <h2 id="ssr-branch">One render, two response formats</h2>
      <p>
        Start at <code>render</code> in <code>packages/core/src/server/application.ts</code>, after
        routing has selected a destination and{" "}
        <a href="/en/architecture/implementation/request">the request has acquired its services</a>.
        It first asks <code>FlightRenderer</code> to render the route. Only then does it choose how
        to deliver the resulting stream: an Accept header exactly equal to{" "}
        <code>text/x-component</code> selects a Flight response; every other value selects HTML.
        This is an exact comparison, not media-type negotiation over an Accept list.
      </p>
      <p>
        For HTML, <code>HtmlRenderer</code> loads the separate SSR environment through{" "}
        <code>import.meta.viteRsc.loadModule("ssr", "index")</code>. In <code>server/ssr.tsx</code>,{" "}
        <code>tee()</code> gives the Flight stream two consumers. The SSR branch uses{" "}
        <code>@vitejs/plugin-rsc/ssr</code> to decode the payload, then renders its{" "}
        <code>RouteTree</code> to HTML with <code>react-dom/server.edge</code>. The other branch
        preserves the Flight data for the browser and is embedded into that HTML. SSR therefore
        consumes the RSC result rather than independently running the Page's server-side render
        Effect again.
      </p>
      <p>
        The HTML renderer also receives form state, a request-scoped abort signal, and a bootstrap
        script that imports the client entry. Both response formats use{" "}
        <code>Cache-Control: private, no-store</code>. The GET and POST pre-response handlers
        preserve existing Vary fields and add Accept unless Accept or <code>*</code> already covers
        it, keeping the format distinction visible to caches.
      </p>
      <h2 id="route-to-flight">Build the shared Flight payload</h2>
      <p>
        To understand what both consumers receive, follow <code>renderRouteTree</code> in{" "}
        <code>rsc/render-route-tree.tsx</code>. It starts with the matched Page, then walks the
        destination's scopes from the innermost outward, adding each Loading boundary and Layout.
        The result is a <code>RouteTreeModel</code> made of <code>id</code>, <code>content</code>,
        and <code>child</code> fields, not an HTML string. Layout IDs use the scope identity, while
        Page and Loading IDs also include the pathname.
      </p>
      <p>
        Before constructing this tree, non-POST requests with a Page parameter Schema decode their{" "}
        <a href="/en/architecture/implementation/routing">route parameters</a>. A decoding failure
        returns an empty 404 response instead of starting Flight rendering. POST requests pass
        encoded parameters into the rendering path, so this early check should not be read as a
        universal pre-render validation step.
      </p>
      <p>
        <code>rsc/flight.ts</code> defines the shared <code>FlightPayload</code>:{" "}
        <code>routeTree</code>, <code>formState</code>, and <code>serverFnResult</code>.{" "}
        <code>FlightRenderer</code> passes that object to <code>@vitejs/plugin-rsc/rsc/server</code>
        's <code>renderToReadableStream</code>, with any temporary references supplied as a
        rendering option. The payload carries the rendering result and action state, not an
        automatic copy of the server's service Context.
      </p>
      <h2 id="render-runtime">Keep asynchronous rendering inside the request</h2>
      <p>
        Obtaining a readable stream does not mean React has finished rendering its contents. A Page,
        Layout, or Component may still need to run an Effect using the current request's services.{" "}
        <code>FlightRenderer</code> therefore creates a child scope for rendering and returns its
        release operation alongside the stream and abort signal.
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
        <code>FiberSet.makeRuntimePromise</code> supplies the Promise-based runner used during React
        rendering, with its fibers owned by <code>renderScope</code>. In{" "}
        <code>application/render-runtime.ts</code>, <code>renderRuntime.bind</code> uses
        AsyncLocalStorage to make that runner and the active middleware chain available to
        asynchronous rendering work. When a Page, Layout, or Component calls <code>run</code>, it
        must find the bound runtime and every middleware scope its definition requires. Missing
        either is a wiring error reported as <code>TypeError</code>, complementing the{" "}
        <a href="/en/architecture/implementation/application">
          service contracts established when definitions are created
        </a>
        .
      </p>
      <p>
        Release belongs to the response lifecycle, not merely to the call that creates the stream.{" "}
        <code>server/application.ts</code> attaches <code>Stream.ensuring(flight.release)</code> to
        both response bodies and releases Flight if HTML startup fails. Flight startup failure
        closes the child scope too; errors reported by React are logged through its runtime unless
        the signal is already aborted. The HTML loading/rendering Promise boundary reports failures
        as <code>HtmlRenderError</code>, while later stream failures travel through the response
        body.
      </p>
      <h2 id="html-eof">Deliver Flight without breaking the HTML stream</h2>
      <p>
        The HTML response must carry both readable markup and the Flight bytes the browser will use
        for hydration. Inserting a script after an arbitrary HTML chunk would be unsafe because a
        chunk can end inside a tag or other HTML syntax. <code>server/flight-html-stream.ts</code>{" "}
        instead waits for HTML EOF before inserting the browser's Flight branch.
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
        <code>makeHtmlWriter</code> forwards markup while retaining bytes that could match the final{" "}
        <code>{"</body></html>"}</code> trailer. At EOF, the transform writes Flight scripts and
        then the closing tags. HTML can still stream because the SSR branch keeps consuming Flight,
        but the browser branch queues until that insertion point. This design does not deliver
        embedded Flight incrementally alongside each HTML chunk.
      </p>
      <p>
        Byte preservation matters as much as placement. Each Flight chunk is decoded independently
        with a fatal UTF-8 decoder; invalid or incomplete UTF-8 falls back to base64 that
        reconstructs a <code>Uint8Array</code> in the browser. Inline scripts also escape{" "}
        <code>{"</script"}</code> and <code>{"<!--"}</code> sequences.{" "}
        <code>client/initial-flight-stream.ts</code> turns strings in{" "}
        <code>self.__FLIGHT_DATA</code> back into bytes, forwards byte arrays unchanged, and closes
        at DOMContentLoaded, or immediately if the document is already ready. That stream becomes
        the input for <a href="/en/architecture/implementation/navigation">browser hydration</a>.
      </p>
      <p>
        Cancellation must also reach both branches without waiting on itself. The outer readable
        stream cancels the Flight reader and releases its lock before cancelling the HTML reader. It
        deliberately does not await the Flight tee branch's cancellation Promise, which can wait for
        its sibling while that sibling needs the request's abort signal to finish. Read and flush
        errors propagate to the stream controller, allowing the{" "}
        <a href="/en/architecture/implementation/request#response-lifetime">response-body owner</a>{" "}
        to complete request cleanup rather than leaving rendering work alive.
      </p>
    </>
  ),
};
