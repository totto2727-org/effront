import { coreModelSources } from "../../core-model";
import { SourceExcerpt } from "../../core-source";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/application",
  title: "02. Application definitions",
  description:
    "Follow a Page from its service contract to request-time execution, and see how Layers, scoped middleware, and application identity keep those steps connected.",
  section: "Architecture",
  group: "Implementation",
  headings: [
    { id: "service-contract", title: "Describe services before acquiring them" },
    { id: "middleware-context", title: "Extend one branch with middleware" },
    { id: "identity", title: "Keep related definitions in one application" },
    { id: "runtime-boundary", title: "Run the definition inside a request" },
  ],
  content: () => (
    <>
      <p>
        Application definitions describe which services a Page may use without acquiring them.
        Layers and middleware supply those services during a request, while a shared application
        identity connects the definitions to their rendering runtime.
      </p>
      <h2 id="service-contract">Describe services before acquiring them</h2>
      <p>
        <code>Application.effront&lt;Services&gt;()</code> in <code>application/effront.ts</code>{" "}
        returns factories for Page, Layout, Routes, and related definitions. It starts neither
        services nor an HTTP server. The returned{" "}
        <code>EFFRONT&lt;ApplicationServices, AvailableServices&gt;</code> separates two contracts:
      </p>
      <ul>
        <li>
          <code>ApplicationServices</code> are supplied by the application's Layer.
        </li>
        <li>
          <code>AvailableServices</code> are usable by definitions from these factories, including
          Page rendering and parameter Schema decoding. Initially they match ApplicationServices,
          but middleware can extend them for one branch.
        </li>
      </ul>
      <p>
        In <code>application/definition.tsx</code>, <code>ApplicationLayerOptions</code> requires a
        Layer unless Services is <code>never</code>. Omitting an optional Layer selects{" "}
        <code>Layer.empty</code>. <code>EFFRONT.make</code> stores that provider alongside the
        compiled Routes. The root must share the application's identity, define a Layout, contain at
        least one Page, and avoid reserved paths.
      </p>
      <p>
        The provider's own dependencies remain <code>Requirements</code> in{" "}
        <code>ApplicationDefinition&lt;Services, ApplicationError, Requirements&gt;</code>, with
        construction failures retained as ApplicationError. Requirements are not automatically
        available to Pages. Exposing an external Service requires the application Layer to provide
        it, for example by forwarding its existing instance with{" "}
        <code>Layer.effect(Service, Service)</code>.
      </p>
      <h2 id="middleware-context">Extend one branch with middleware</h2>
      <p>
        A service needed only by an authenticated branch belongs in that branch's AvailableServices.{" "}
        <code>withMiddleware</code> creates new factories that record both the added service type
        and the middleware responsible for providing it:
      </p>
      <SourceExcerpt locale="en" source={coreModelSources.middlewareScope} />
      <p>
        <code>ApplicableMiddleware</code> checks that the next middleware's requirements are already
        available. The returned factory adds <code>MiddlewareProvidedServices</code> to that set.
        Runtime checks reject the wrong member kind, a different application identity, or a
        duplicate in the same scope. The original factories remain unchanged, so scoped and unscoped
        branches can coexist.
      </p>
      <p>
        Neither registration nor the <code>provides</code> type declaration injects a service. The
        handler in <code>application/middleware.ts</code> must provide it to the HTTP response
        Effect it wraps. Definitions from the extended factories retain the middleware chain for
        request-time execution.
      </p>
      <ul>
        <li>
          <strong>Page GET/HEAD:</strong> native Effect HTTP middleware descriptors preserve routing
          behavior, including HEAD fallback.
        </li>
        <li>
          <strong>Server Function POST:</strong> React decoding identifies the function's scope
          before <code>applyMiddleware</code> wraps its Effect with handlers.{" "}
          <code>reduceRight</code> makes earlier registrations outer wrappers, so they can supply
          services to later ones.
        </li>
      </ul>
      <h2 id="identity">Keep related definitions in one application</h2>
      <p>
        Every factory derived from one <code>Application.effront</code> call shares an identity, a
        route-scope ID allocator, and the same <code>make</code> function.{" "}
        <code>withMiddleware</code> preserves these rather than creating another application:
      </p>
      <SourceExcerpt locale="en" source={coreModelSources.applicationIdentity} />
      <p>
        Separate calls create separate identities even when their Services types match.{" "}
        <code>Routes.page</code>, <code>Routes.mount</code>, and <code>makeApplication</code> reject
        mixed identities with <code>TypeError</code>. These are definition-wiring errors, not
        invalid request input.
      </p>
      <p>
        <code>application/effront-identity.ts</code> records membership through{" "}
        <code>EFFRONTMember</code> symbols for identity and member kind. The identity holds an
        invariant Services type marker and its own <code>renderRuntime</code>, linking
        definition-time contracts to request-time execution.
      </p>
      <h2 id="runtime-boundary">Run the definition inside a request</h2>
      <p>
        <code>server/application.ts</code> builds the application and renderer Layers for the
        request. <code>RequestContextMiddleware</code> merges the acquired services into the HTTP
        Context, and scoped middleware can add services required by the selected definitions.
      </p>
      <p>
        React invokes Page and Layout outside an Effect call stack.{" "}
        <code>application/render-runtime.ts</code> bridges that boundary: <code>bind</code> stores
        an Effect runner and active middleware in AsyncLocalStorage, and <code>run</code> delegates
        each render Effect to that runner. Missing runtime bindings or inactive required middleware
        produce <code>TypeError</code>. Correct service types do not replace these runtime scope
        checks.
      </p>
      <p>
        <a href="/en/architecture/implementation/routing">Route assembly</a> connects these
        definitions to destinations.{" "}
        <a href="/en/architecture/implementation/request">Request processing</a> explains service
        ownership, and <a href="/en/architecture/implementation/rendering">rendering</a> follows the
        React boundary.
      </p>
    </>
  ),
};
