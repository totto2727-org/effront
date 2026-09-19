import { CodeBlock } from "../../../components/code-block";
import { coreRuntimeSources } from "../../core-runtime";
import type { CoreSource } from "../../core-source";
import type { DocPage } from "../../types";

function SourceExcerpt({ source }: { readonly source: CoreSource }) {
  return (
    <figure data-core-source={source.path}>
      <figcaption>
        Excerpt from <code>{source.path}</code>
      </figcaption>
      <CodeBlock code={source.code} language={source.language} />
    </figure>
  );
}

export const page: DocPage = {
  slug: "/architecture/implementation/request",
  title: "04. Request services and their lifetimes",
  description:
    "Trace how a request acquires application services, keeps them alive while streaming, and borrows host-owned services without taking ownership.",
  section: "Architecture",
  group: "Implementation",
  headings: [
    { id: "fetch-entry", title: "1. Acquire services for the current request" },
    { id: "request-services", title: "2. Make those services available to routes" },
    { id: "response-lifetime", title: "3. Keep resources alive through the response body" },
    { id: "host-boundary", title: "4. Reuse host services without reusing request state" },
  ],
  content: () => (
    <>
      <p>
        A streaming response can outlive the code that creates it. To understand when an application
        service is safe to use, follow both how a request acquires it and who eventually releases
        it. This chapter traces that ownership from the HTTP entry point through route execution to
        the end of the response body, then explains how a reusable handler borrows services from its
        host.
      </p>
      <p>
        The starting point is an{" "}
        <a href="/en/architecture/implementation/application">application definition</a> with a
        Layer and <a href="/en/architecture/implementation/routing">registered routes</a>. The
        implementation is in <code>packages/core/src/http.ts</code> and{" "}
        <code>packages/core/src/server/application.ts</code>. Read this path when investigating
        services shared across requests or resources released before rendering finishes.
      </p>
      <h2 id="fetch-entry">1. Acquire services for the current request</h2>
      <p>
        <code>toHttpEffect(application)</code> returns an Effect that handles the current{" "}
        <code>HttpServerRequest</code> and produces an <code>HttpServerResponse</code>. Its caller
        supplies the request Scope and any external services required by the application Layer.
        Creating this Effect does not build the application services: acquisition happens when the
        Effect runs for a request.
      </p>
      <SourceExcerpt source={coreRuntimeSources.requestHandler} />
      <p>
        The fresh <code>Layer.CurrentMemoMap</code> is what separates this acquisition from Layers
        already memoized during host construction. <code>HttpRouter.toHttpEffect</code> builds the
        application HTTP Layer inside that evaluation, and the resulting handler runs immediately.
        Reusing the Effect therefore still builds the request Layer per evaluation, with access to
        the current request and host-provided services.
      </p>
      <p>
        Before acquiring services, the entry point rejects a supplied Content-Length if its numeric
        value is not a safe nonnegative integer or exceeds 10 MiB, returning 413. This checks the
        header, not the measured size of a body without that header.{" "}
        <a href="/en/architecture/implementation/server-functions">Server Function decoding</a>{" "}
        applies a separate limit while reading its body.
      </p>
      <p>
        The Web Fetch bridge follows the same path. <code>createFetchHandler</code> in{" "}
        <code>workers.ts</code> passes this Effect to <code>HttpEffect.toWebHandler</code> and
        provides a fresh <code>WorkersRequestContext</code> for each call. The bridge supplies host
        values rather than replacing the request acquisition model.
      </p>
      <h2 id="request-services">2. Make those services available to routes</h2>
      <p>
        In <code>ServerApplication.httpLayer</code>, <code>RequestLayer</code> combines the
        application's Layer with <code>FlightRenderer.layer</code> and{" "}
        <code>HtmlRenderer.layer</code>. <code>Layer.build(RequestLayer)</code> produces the{" "}
        <code>applicationServices</code> Context captured by the route middleware for this request.{" "}
        <code>RequestContextMiddleware</code> merges that Context into the live HTTP Context before
        executing a route. Route execution can therefore use both the current HTTP services and the
        services just acquired for the application.
      </p>
      <p>
        This also explains the two type parameters at the boundary: <code>Services</code> describes
        what the application Layer provides, while <code>Requirements</code> describes what must be
        supplied to build or run it. Those external requirements remain in the HTTP Effect's type
        rather than disappearing when the router is assembled.
      </p>
      <p>
        Once the services are available, middleware can run around the selected work. GET routes
        compose the page's middleware through Effect HTTP middleware descriptors. POST routes first
        decode the React Server Function reference, then apply the selected function's middleware
        and any additional middleware needed to refresh the page. Both paths use the request's
        acquired services, but function-specific middleware cannot be selected until decoding
        identifies the function.
      </p>
      <h2 id="response-lifetime">3. Keep resources alive through the response body</h2>
      <p>
        Returning an <code>HttpServerResponse</code> does not mean a streaming render has finished
        using those services. The host must keep the request Scope open until the body ends, fails,
        or is cancelled. Effect HTTP's Web handler transfers that lifetime to the response stream
        automatically. A non-stream response, such as already-produced text, releases request
        resources when request handling completes rather than waiting for the caller to read the
        text.
      </p>
      <SourceExcerpt source={coreRuntimeSources.responseLifetime} />
      <p>
        HEAD needs special handling because its body will never be consumed. The pinned Effect
        rc.112 transfers a streaming response's Scope before discarding a HEAD body. Effront
        replaces that body with <code>HttpBody.empty</code> while retaining the response headers,
        preventing ownership from moving to an unread stream.
      </p>
      <p>
        A host connecting directly to the HTTP Effect must preserve the same lifetime boundary.
        Wrapping only response production in <code>Effect.scoped</code> closes resources too early
        for a deferred body. For a custom body that reads services later, also bind the required
        Context when constructing that body: keeping a service alive and making it available to a
        later Effect are separate responsibilities.
      </p>
      <p>
        Rendering adds a child Scope for Flight work and an explicit release operation tied to
        stream completion. The{" "}
        <a href="/en/architecture/implementation/rendering">rendering chapter</a> follows how that
        child Scope connects to the HTTP response lifetime.
      </p>
      <h2 id="host-boundary">4. Reuse host services without reusing request state</h2>
      <p>
        A host may already own services that many requests need.{" "}
        <code>makeHttpEffect(application)</code> captures references to those external services and
        returns a reusable HTTP Effect. It does not acquire the application's request Layer at
        construction time or take ownership of the captured services. Their owner must remain alive
        until every response body using them has finished.
      </p>
      <SourceExcerpt source={coreRuntimeSources.externalContext} />
      <p>
        The merge gives the live request Context precedence over captured values. Before that merge,{" "}
        <code>captureExternalContext</code> removes the construction-time Scope, HTTP request,
        parsed search parameters, route Context, router, and Layer memo map. This explicit removal
        matters because the type argument to <code>Effect.context&lt;R&gt;()</code> does not filter
        runtime keys. Reusing the handler must not restore the request state that happened to be
        present when it was constructed.
      </p>
      <p>
        For Fetch hosts, <code>WorkersRequestContext</code> holds the current <code>request</code>,{" "}
        <code>env</code>, and <code>executionContext</code> as readonly fields.{" "}
        <code>createWorkersContextAccessors</code> creates typed readers for that existing
        reference, not another Service or Layer. The types describe host-supplied values without
        validating them at runtime, and reading the reference when it has not been supplied throws a{" "}
        <code>TypeError</code>.
      </p>
      <p>
        <code>@effront/cloudflare/workers</code> specializes those readers with a{" "}
        <code>CloudflareExecutionContext</code> containing{" "}
        <code>waitUntil(Promise&lt;unknown&gt;)</code>. This is an adapter boundary, separate from
        build integration: the host values stay in the Effect Context and are not automatically
        added to Flight or HTML. Together with the{" "}
        <a href="/en/architecture/implementation/overview">architecture overview</a>, this separates
        the host's shared-service ownership from each request's acquisition and each response's
        streaming lifetime.
      </p>
    </>
  ),
};
