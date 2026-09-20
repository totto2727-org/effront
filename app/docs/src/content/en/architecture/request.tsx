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
        Request services must outlive response construction when the body is still streaming.
        Effront acquires the application Layer per request and leaves response-body lifetime
        management to the host's HTTP boundary. Capturing host-owned services is a separate
        operation that transfers neither ownership nor lifetime.
      </p>
      <p>
        The <a href="/en/architecture/implementation/application">application definition</a>{" "}
        supplies the Layer and <a href="/en/architecture/implementation/routing">compiled routes</a>
        . <code>packages/core/src/http.ts</code> and <code>server/application.ts</code> connect them
        to each request.
      </p>
      <h2 id="fetch-entry">1. Acquire services for the current request</h2>
      <p>
        <code>toHttpEffect(application)</code> handles the current <code>HttpServerRequest</code>{" "}
        and produces an <code>HttpServerResponse</code>. The caller supplies a request Scope and the
        application Layer's external requirements. Services are acquired when this Effect runs, not
        when it is created:
      </p>
      <SourceExcerpt source={coreRuntimeSources.requestHandler} />
      <p>
        A fresh <code>Layer.CurrentMemoMap</code> prevents reuse of application instances memoized
        during host construction. <code>HttpRouter.toHttpEffect</code> builds the application HTTP
        Layer and immediately runs its handler in the current Context. Reusing the Effect still
        acquires the Layer per evaluation.
      </p>
      <p>
        Before acquisition, a supplied Content-Length must convert to a safe nonnegative integer no
        greater than 10 MiB, or the entry returns 413. This checks the header, not the measured body
        size when the header is absent.{" "}
        <a href="/en/architecture/implementation/server-functions">Server Function decoding</a>{" "}
        separately limits bytes read.
      </p>
      <p>
        <code>createFetchHandler</code> in <code>workers.ts</code> uses{" "}
        <code>HttpEffect.toWebHandler</code> with this Effect. Each call adds a fresh{" "}
        <code>WorkersRequestContext</code> without changing request acquisition.
      </p>
      <h2 id="request-services">2. Make those services available to routes</h2>
      <p>
        <code>ServerApplication.httpLayer</code> combines the application Layer,{" "}
        <code>FlightRenderer.layer</code>, and <code>HtmlRenderer.layer</code> into{" "}
        <code>RequestLayer</code>. <code>Layer.build(RequestLayer)</code> produces the{" "}
        <code>applicationServices</code> Context. Before route execution,{" "}
        <code>RequestContextMiddleware</code> merges it into the live HTTP Context.
      </p>
      <p>
        <code>Services</code> describes the application Layer's outputs. <code>Requirements</code>{" "}
        describes external services needed to construct or run it and remains in the HTTP Effect's
        type. Assembling the router does not satisfy those external requirements.
      </p>
      <p>
        GET routes compose Page middleware through native Effect HTTP descriptors. POST first
        decodes the React function reference, then applies its middleware and any additional
        middleware needed to refresh the destination. Both use the request's acquired services, but
        function-specific middleware cannot be selected before decoding identifies the function.
      </p>
      <h2 id="response-lifetime">3. Keep resources alive through the response body</h2>
      <p>
        A streaming <code>HttpServerResponse</code> still needs its request Scope after headers are
        produced. Effect HTTP's Web handler transfers that Scope to the body until completion,
        failure, or cancellation. Non-stream responses, such as generated text, release resources
        when handling finishes without waiting for a reader.
      </p>
      <SourceExcerpt source={coreRuntimeSources.responseLifetime} />
      <p>
        HEAD bodies are never consumed. The pinned Effect rc.112 transfers a streaming response's
        Scope before discarding its HEAD body. Effront first replaces the body with{" "}
        <code>HttpBody.empty</code> and preserves the headers, avoiding transfer to an unread
        stream.
      </p>
      <p>
        A direct HTTP host must preserve the same boundary. Applying <code>Effect.scoped</code> only
        to response production closes resources too early for deferred body work. A custom body that
        reads services later must also capture the needed Context: keeping services alive does not
        automatically provide them to a later Effect.
      </p>
      <p>
        Flight rendering adds a child Scope and release operation tied to stream completion.{" "}
        <a href="/en/architecture/implementation/rendering">Rendering</a> explains how that child
        joins the response lifecycle.
      </p>
      <h2 id="host-boundary">4. Reuse host services without reusing request state</h2>
      <p>
        <code>makeHttpEffect(application)</code> captures references to external services and
        returns a reusable HTTP Effect. It neither builds the application's request Layer during
        construction nor takes ownership of the references. Their owner must keep them alive until
        all response bodies using them finish.
      </p>
      <SourceExcerpt source={coreRuntimeSources.externalContext} />
      <p>
        Live request values take precedence over captured values. Before merging them,{" "}
        <code>captureExternalContext</code> removes the construction-time Scope, HTTP request,
        parsed search parameters, route Context, router, and Layer memo map. This removal is
        explicit because <code>Effect.context&lt;R&gt;()</code> does not filter runtime keys by its
        type argument.
      </p>
      <p>
        <code>WorkersRequestContext</code> holds readonly <code>request</code>, <code>env</code>,
        and <code>executionContext</code> fields. <code>createWorkersContextAccessors</code> creates
        typed readers for that reference, not a new Service or Layer. The types do not validate host
        values, and reading an absent reference throws <code>TypeError</code>.
      </p>
      <p>
        <code>@effront/cloudflare/workers</code> specializes those readers with a{" "}
        <code>CloudflareExecutionContext</code> that includes{" "}
        <code>waitUntil(Promise&lt;unknown&gt;)</code>. These host values stay in Effect Context
        rather than being implicitly serialized into Flight or HTML. The{" "}
        <a href="/en/architecture/implementation/overview">architecture overview</a> places this
        adapter boundary alongside the rendering and browser entrypoints.
      </p>
    </>
  ),
};
