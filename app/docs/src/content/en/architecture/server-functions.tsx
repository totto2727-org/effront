import { CodeBlock } from "../../../components/code-block";
import { coreRuntimeSources } from "../../core-runtime";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/server-functions",
  title: "07. From Server Function calls to refreshed UI",
  description: "How a Server Function call becomes server-side work and a refreshed page.",
  section: "Architecture",
  group: "Implementation",
  headings: [
    { id: "request-decoding", title: "1. Identify and validate the incoming call" },
    {
      id: "function-definition",
      title: "2. Recover the typed operation behind the React reference",
    },
    { id: "execution-outcome", title: "3. Execute within middleware and render the outcome" },
    { id: "result-refresh", title: "4. Settle the call before choosing a UI refresh" },
  ],
  content: () => (
    <>
      <p>
        A valid Flight response to a browser Server Function call carries both an invocation outcome
        and a refreshed route tree. A function failure can therefore arrive with HTTP 200, while a
        successful but stale response must not restore a page the user has left. For application
        usage, see the{" "}
        <a href="/en/advanced/server-function-execution-and-refresh">execution and refresh guide</a>
        .
      </p>
      <h2 id="request-decoding">1. Identify and validate the incoming call</h2>
      <p>
        <code>client/call-server.ts</code> records the current history entry or URL and an
        increasing invocation order. It encodes arguments with React's <code>encodeReply</code> and
        uses <code>FlightClient</code> to POST to that URL, sending <code>x-effront-server-fn</code>{" "}
        and requesting Flight. The destination's POST handler calls{" "}
        <code>prepareServerFnRequest</code>.
      </p>
      <p>
        Before decoding, <code>validateOrigin</code> compares the parsed Origin URL's host with the
        lowercased Host header. Missing headers, an invalid Origin URL, or a mismatch return 403.
        This compares hosts, not schemes or complete origins, and does not authenticate or authorize
        the operation. The request becomes a Web Request with the request Scope's AbortSignal. An
        action-ID header selects the client-call path. Its absence selects the progressive form path
        used without JavaScript.
      </p>
      <p>
        Both paths count actual bytes read and reject bodies over 10 MiB with 400. The{" "}
        <a href="/en/architecture/implementation/request">HTTP entry's Content-Length check</a> is
        separate and can return 413 before reading. Buffered multipart bodies become FormData; other
        bodies become text. Read and multipart-parsing failures return 400.
      </p>
      <figure data-core-source={coreRuntimeSources.serverFnDecode.path}>
        <figcaption>
          Excerpt from <code>{coreRuntimeSources.serverFnDecode.path}</code>
        </figcaption>
        <CodeBlock
          code={coreRuntimeSources.serverFnDecode.code}
          language={coreRuntimeSources.serverFnDecode.language}
        />
      </figure>
      <p>
        <code>decodeReply</code> reconstructs arguments with an array-size limit of 10,000 and
        temporary references. Effront verifies an array result, then <code>loadServerAction</code>{" "}
        resolves the function. Decode, array-shape, and lookup failures return 400 before
        application input validation. The server carries temporary references into Flight, and the
        browser decodes with the set passed to <code>encodeReply</code>.
      </p>
      <h2 id="function-definition">2. Recover the typed operation behind the React reference</h2>
      <p>
        Invoking a Server Function created by <code>makeServerFnFactory</code> returns a branded
        Promise describing an Effect instead of immediately running the handler. This lets HTTP
        processing recover its application identity and middleware before execution:
      </p>
      <figure data-core-source={coreRuntimeSources.serverFnSchema.path}>
        <figcaption>
          Excerpt from <code>{coreRuntimeSources.serverFnSchema.path}</code>
        </figcaption>
        <CodeBlock
          code={coreRuntimeSources.serverFnSchema.code}
          language={coreRuntimeSources.serverFnSchema.language}
        />
      </figure>
      <p>
        Callers supply Schema <code>Encoded</code> values; handlers receive decoded{" "}
        <code>Type</code> values after <code>Schema.Tuple</code> succeeds. A single Schema decodes
        the first argument, ignores extra native arguments, and decodes undefined when omitted. A
        Schema array validates the positional list. Decoding and handlers can require{" "}
        <code>AvailableServices</code>, and their typed failures become{" "}
        <code>ServerFnOperationError</code>.
      </p>
      <p>
        The returned Promise carries a brand with the Effect, identity, and middleware. Directly
        awaiting it in the server graph rejects with <code>TypeError</code>. HTTP instead uses{" "}
        <code>matchServerFnInvocation</code> to recover the operation and verify{" "}
        <a href="/en/architecture/implementation/application">application identity</a>. A different
        EFFRONT identity is rejected. Unbranded native React Server Functions follow a separate path
        that awaits their result in an Effect without Effront function middleware.
      </p>
      <h2 id="execution-outcome">3. Execute within middleware and render the outcome</h2>
      <p>
        <code>PreparedServerFnRequest</code> contains <code>execute</code> and the function's
        middleware. <code>executeServerFnAndRefresh</code> in <code>server/application.ts</code>{" "}
        wraps execution and rendering in that middleware. Middleware needed only by the destination
        wraps rendering, excluding entries already applied for the function. The renderer receives
        the combined list for runtime scope checks.
      </p>
      <p>
        For client calls, <code>serverFnOutcome</code> converts the operation's Exit to Success or
        Failure in <code>serverFnResult</code>. Both render with status 200, so HTTP success does
        not establish function success. Interruption remains interruption rather than Failure data.
        The <a href="/en/architecture/implementation/rendering">Flight payload</a> carries both the
        result and the route tree.
      </p>
      <p>
        Progressive forms require multipart FormData and React's <code>decodeAction</code>. Missing
        or undecodable actions return 400. After execution, <code>decodeFormState</code> supplies
        state to SSR and hydration. Success renders status 200 with <code>formState</code> and{" "}
        <code>serverFnResult: null</code>, producing HTML for a normal document form request. Typed
        execution failures and form-state decode failures return 500. The POST route turns{" "}
        <code>ServerFnRequestError</code> into its specified status and a text response, not a
        function-result payload.
      </p>
      <h2 id="result-refresh">4. Settle the call before choosing a UI refresh</h2>
      <p>
        Non-2xx, non-Flight, and missing-result responses reject the browser call without
        result-driven refresh. A valid Success resolves the caller's Promise; a valid Failure
        rejects it with <code>ServerFnCallError</code>. Effront registers its continuation after
        settlement so React's existing Action reactions run before the refresh Transition. Both
        outcomes then use the same refresh decision: function failure does not imply an unchanged
        UI.
      </p>
      <p>The returned tree is reusable only when:</p>
      <ul>
        <li>It belongs to the most recently started invocation.</li>
        <li>No navigation transition is in progress.</li>
        <li>
          The current history entry matches the captured ID, or both have no entry and the URL is
          unchanged.
        </li>
      </ul>
      <p>
        Effront checks again after interrupting an older refresh because cleanup can allow another
        invocation or navigation to win. An unsuitable response is released, and{" "}
        <code>RouteRefresher.refreshCurrentRoute("server-function")</code> refreshes the current
        destination instead. That path waits for navigation to settle and races the refresh against
        new routed navigation.
      </p>
      <p>
        For a reusable response, <code>RouteLoader.prepareRefresh</code> invalidates the cache and{" "}
        <code>startTransition</code> publishes the tree with type <code>server-function</code>. The
        Transition Action does not return the commit Promise, which would block the commit it
        awaits. A separate scoped Fiber waits for response completion and React commit before
        caching, or stops if the publication retires first. Cleanup releases the response in either
        case. This shares the ownership boundaries of{" "}
        <a href="/en/architecture/implementation/navigation">navigation</a> within the{" "}
        <a href="/en/architecture/implementation/overview">request-to-browser flow</a>.
      </p>
    </>
  ),
};
