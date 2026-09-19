import { CodeBlock } from "../../../components/code-block";
import { coreRuntimeSources } from "../../core-runtime";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/server-functions",
  title: "07. From Server Function calls to refreshed UI",
  description:
    "Trace a Server Function POST through input validation, request-scoped execution, and UI refresh to distinguish transport errors, function failures, and stale responses.",
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
        A Server Function call has two results to coordinate: the value returned to its caller and
        the page rendered after execution. Understanding their separate paths explains why a failed
        function can arrive in an HTTP 200 response, or why a late response must not restore a page
        the user has left. This chapter follows one POST from validation to browser refresh. For
        application code rather than implementation details, see the{" "}
        <a href="/en/advanced/server-function-execution-and-refresh">execution and refresh guide</a>
        .
      </p>
      <h2 id="request-decoding">1. Identify and validate the incoming call</h2>
      <p>
        The browser callback in <code>client/call-server.ts</code> records the current history entry
        or URL and a monotonically increasing invocation order. It encodes the arguments with
        React's <code>encodeReply</code>, then asks <code>FlightClient</code> to POST to that URL
        with <code>x-effront-server-fn</code> identifying the action and an Accept header requesting
        Flight. The server's destination POST route passes the request to{" "}
        <code>prepareServerFnRequest</code>.
      </p>
      <p>
        Before decoding an action, <code>validateOrigin</code> requires Origin and compares its
        parsed URL host with the lowercased Host header. Missing headers, an invalid Origin URL, or
        a mismatch produce 403. This compares hosts, not complete origins including their schemes.
        The request is then converted to a Web Request using the request scope's AbortSignal. An
        action-ID header selects the client-call path. Its absence selects the progressive form path
        used without JavaScript.
      </p>
      <p>
        Both paths count the bytes actually read and reject a body larger than 10 MiB with 400. This
        is separate from the HTTP entry's Content-Length check, which can return 413 before reading
        the body, as described in the{" "}
        <a href="/en/architecture/implementation/request">request lifetime chapter</a>. The buffered
        body becomes FormData for multipart requests or text otherwise. Body-read and
        multipart-parsing failures also become request errors with status 400.
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
        For a client call, <code>decodeReply</code> reconstructs React arguments with an array-size
        limit of 10,000 and a temporary reference set. Effront then checks that the result is an
        array before <code>loadServerAction</code> resolves the function reference. Decoding,
        argument-array validation, and lookup errors return 400. This verifies the transport shape,
        not the function's application input schema. The server carries its temporary references
        into the Flight response, while the browser decodes that response using the set it supplied
        to <code>encodeReply</code>.
      </p>
      <h2 id="function-definition">2. Recover the typed operation behind the React reference</h2>
      <p>
        Resolving a React reference identifies the function, but an Effront function also needs the
        right application services and middleware before its handler can run.{" "}
        <code>makeServerFnFactory</code> preserves that information by making invocation return a
        description of the Effect to execute, rather than running the handler immediately.
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
        The caller supplies the schema's Encoded values. The handler receives its decoded Type
        values only after <code>Schema.Tuple</code> succeeds. A single input schema decodes only the
        first argument, ignores extra native arguments, and decodes undefined when that argument is
        omitted. A schema array validates the positional argument list instead. Decoding and the
        handler may require <code>AvailableServices</code>, and their typed failures are wrapped in{" "}
        <code>ServerFnOperationError</code>.
      </p>
      <p>
        The returned Promise carries an internal brand containing the Effect, application identity,
        and middleware. Directly awaiting it in the server graph rejects with TypeError. The HTTP
        path instead uses <code>matchServerFnInvocation</code> to recover the operation and verify
        its <a href="/en/architecture/implementation/application">application identity</a>. A
        function from another EFFRONT module is an identity mismatch, not permission to use that
        module's services. An unbranded native React Server Function follows a separate path that
        awaits its result in an Effect without Effront function middleware.
      </p>
      <h2 id="execution-outcome">3. Execute within middleware and render the outcome</h2>
      <p>
        Preparation produces <code>PreparedServerFnRequest</code>, containing <code>execute</code>{" "}
        and the function's middleware. In <code>server/application.ts</code>,{" "}
        <code>executeServerFnAndRefresh</code> wraps both execution and subsequent rendering in that
        middleware. Middleware required only by the destination wraps the rendering step, and
        entries already present in the function's middleware are not applied a second time there.
        The renderer receives the combined list so its runtime scope checks see the middleware
        available to the refreshed page.
      </p>
      <p>
        For a client call, <code>serverFnOutcome</code> turns the operation's Exit into either a
        Success value or a Failure error in <code>serverFnResult</code>. Both outcomes proceed to
        rendering with status 200, so HTTP success alone does not establish function success.
        Interruption is different: both failure normalization and outcome handling preserve it as
        interruption rather than returning Failure data. The resulting{" "}
        <a href="/en/architecture/implementation/rendering">Flight payload</a> carries the route
        tree alongside the function result.
      </p>
      <p>
        A progressive form submission needs a different result because there is no client-call
        Promise to settle. It requires multipart FormData and uses React's <code>decodeAction</code>
        . A missing or undecodable action returns 400. After execution, <code>decodeFormState</code>{" "}
        builds the state passed to both SSR and hydration. Success renders with status 200,{" "}
        <code>formState</code>, and <code>serverFnResult: null</code>, returning HTML for a normal
        document form request. Typed form execution errors and form-state decoding errors return
        500. The POST route converts <code>ServerFnRequestError</code> into its specified status and
        a text response, rather than a function-result payload.
      </p>
      <h2 id="result-refresh">4. Settle the call before choosing a UI refresh</h2>
      <p>
        Back in the browser, a non-2xx response, a non-Flight response, or a missing function result
        rejects the call instead of entering the result-driven refresh path. A valid Success
        resolves the caller's Promise with its value. A valid Failure rejects it with{" "}
        <code>ServerFnCallError</code>. Effront registers its continuation after settlement,
        allowing React's already-registered Action reactions to run before it starts the refresh
        Transition. Both Success and Failure then reach the same refresh decision. Failure does not
        mean “leave the UI unchanged.”
      </p>
      <p>The returned tree is reusable only if all of these conditions still hold:</p>
      <ul>
        <li>The response belongs to the most recently started invocation.</li>
        <li>No navigation transition is in progress.</li>
        <li>
          The current history entry still has the captured ID, or, when no entry was available,
          there is still no entry and the URL is unchanged.
        </li>
      </ul>
      <p>
        Effront checks again after interrupting an existing route refresh because cleanup may give
        another invocation or navigation time to win. If the response is no longer suitable, it
        releases that resource and calls{" "}
        <code>RouteRefresher.refreshCurrentRoute("server-function")</code> instead. That path waits
        for navigation to settle and races its refresh against a new routed navigation, rather than
        blindly publishing the old response.
      </p>
      <p>
        When the response is reusable, <code>RouteLoader.prepareRefresh</code> invalidates the cache
        and the new tree is published inside <code>startTransition</code> with transition type{" "}
        <code>server-function</code>. The publication's commit Promise is deliberately not returned
        from that Transition Action: waiting there would prevent the commit it needs. A separate
        scoped Fiber waits for both response completion and React commit before saving the cache, or
        stops waiting if the publication is retired first. Cleanup releases the response resource in
        either case. Compare this ownership with{" "}
        <a href="/en/architecture/implementation/navigation">navigation</a>, or return to the{" "}
        <a href="/en/architecture/implementation/overview">implementation overview</a> to place the
        call in the full request-to-browser flow.
      </p>
    </>
  ),
};
