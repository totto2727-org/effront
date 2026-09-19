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
        A Page can declare an Effect that uses application services long before a request arrives.
        To understand how that Effect eventually runs, separate the definition of a dependency from
        the acquisition of its value. This chapter follows that distinction through the core
        implementation, so you can trace a service from a Page's type contract to the request that
        supplies it.
      </p>
      <h2 id="service-contract">Describe services before acquiring them</h2>
      <p>
        Start with <code>Application.effront&lt;Services&gt;()</code> in{" "}
        <code>application/effront.ts</code>. It returns factories for definitions such as Page,
        Layout, and Routes, rather than starting services or an HTTP server. The service type tells
        those factories what their definitions may require, while the actual provider is supplied
        later to <code>EFFRONT.make</code> as a Layer.
      </p>
      <p>
        The returned <code>EFFRONT&lt;ApplicationServices, AvailableServices&gt;</code> keeps two
        service types because not every Page needs the same dependencies. They initially match, but
        middleware can extend what is available to one branch without changing the application's
        base contract.
      </p>
      <ul>
        <li>
          <code>ApplicationServices</code> describes the base services supplied by the application's
          Layer.
        </li>
        <li>
          <code>AvailableServices</code> describes what definitions created by this factory can use.
          For <code>PageFactory</code>, that includes both the render Effect and the services needed
          to decode its parameter Schema.
        </li>
      </ul>
      <p>
        In <code>application/definition.tsx</code>, <code>ApplicationLayerOptions</code> requires a
        Layer when Services is not <code>never</code>. When it is <code>never</code>, the Layer is
        optional and omission resolves to <code>Layer.empty</code>. This is where a declared service
        contract gets a provider, not where its services are acquired.
      </p>
      <p>
        The provider can have dependencies of its own.{" "}
        <code>ApplicationDefinition&lt;Services, ApplicationError, Requirements&gt;</code> retains
        these inputs as Requirements and the Layer's construction error type as ApplicationError.
        Requirements does not automatically become part of the services available to a Page. To
        expose an external Service to Pages, the application Layer must provide it explicitly, for
        example by forwarding the existing instance with <code>Layer.effect(Service, Service)</code>
        .
      </p>
      <p>
        <code>EFFRONT.make</code> combines this Layer with the root Routes. Its root contract
        requires a Layout, at least one path to a Page, and no reserved paths.{" "}
        <code>makeApplication</code> checks the root's application identity, calls{" "}
        <code>compileRouteGraph</code>, and stores the compiled routes alongside the Layer. The
        resulting definition is a description of what to serve and how to obtain its services, ready
        for the request-processing code to use.
      </p>
      <h2 id="middleware-context">Extend one branch with middleware</h2>
      <p>
        Suppose only an authenticated part of the application needs a service supplied by
        authentication middleware. That service belongs in the branch's AvailableServices rather
        than in the base ApplicationServices contract. <code>withMiddleware</code> creates the
        factories for that branch, recording both the additional service type and the middleware
        that must provide it.
      </p>
      <SourceExcerpt locale="en" source={coreModelSources.middlewareScope} />
      <p>
        Read the type signature as an ordered dependency check. <code>ApplicableMiddleware</code>{" "}
        accepts the next middleware only when its requirements are already covered by
        AvailableServices. The returned factory then adds <code>MiddlewareProvidedServices</code> to
        that available set. At runtime, the method checks the middleware's kind, application
        identity, and absence of duplicates in the same scope before returning a new middleware
        array and new factories. The original EFFRONT value remains unchanged, so branches with and
        without the middleware can coexist.
      </p>
      <p>
        Registration is not execution: neither <code>withMiddleware</code> nor the{" "}
        <code>provides</code> type declaration injects a service into Context. The handler defined
        through <code>application/middleware.ts</code> must actually provide that service to the
        HTTP response Effect it wraps. Definitions made from the extended factories retain the
        middleware chain for use when a request executes them.
      </p>
      <p>
        That chain has two execution paths, which explains why middleware state stores both{" "}
        <code>httpMiddleware</code> and <code>handler</code>. Page GET/HEAD requests compose the
        native Effect HTTP middleware descriptor, preserving routing behavior such as HEAD fallback.
        A Server Function POST discovers its scope only after React decodes the invoked reference,
        so <code>applyMiddleware</code> wraps the Effect with handlers using{" "}
        <code>reduceRight</code>. Earlier registrations become outer wrappers, allowing them to
        provide services needed by later ones.
      </p>
      <h2 id="identity">Keep related definitions in one application</h2>
      <p>
        Extending AvailableServices does not create a new application. Both branches still need to
        join the same Routes and execute through the same application's rendering machinery. To
        preserve that connection, every factory derived from one <code>Application.effront</code>{" "}
        call shares an identity object.
      </p>
      <SourceExcerpt locale="en" source={coreModelSources.applicationIdentity} />
      <p>
        Here, <code>make</code> closes over the identity and <code>makeEFFRONT</code> passes it to
        the factories. The <code>allocateRouteScopeId</code> counter is shared too, giving each new
        Routes scope a number within this application. Compare this with the earlier{" "}
        <code>withMiddleware</code> excerpt: it passes the existing identity, allocator, and make
        function into the new factory group instead of creating a fresh application.
      </p>
      <p>
        Matching service types alone do not establish this relationship. Separate calls to{" "}
        <code>Application.effront</code> create separate identities, even when their Services types
        are identical. Operations such as <code>Routes.page</code>, <code>Routes.mount</code>, and{" "}
        <code>makeApplication</code> reject mixed identities with TypeError. These checks catch
        invalid wiring between definitions, not invalid request input.
      </p>
      <p>
        <code>application/effront-identity.ts</code> represents membership through{" "}
        <code>EFFRONTMember</code>, with symbol keys for the identity and member kind. The identity
        carries an invariant Services type marker and its own <code>renderRuntime</code>. That
        runtime is the connection from the definitions assembled here to the request-time execution
        described next.
      </p>
      <h2 id="runtime-boundary">Run the definition inside a request</h2>
      <p>
        When a request is processed, <code>server/application.ts</code> builds the application Layer
        together with the renderer Layer. <code>RequestContextMiddleware</code> merges the acquired
        services into the HTTP request's Context. The stored provider now supplies actual service
        values, and scoped middleware can add the services required by the selected definitions.
      </p>
      <p>
        Page and Layout are called by React, so they need a bridge into that Effect execution
        context. In <code>application/render-runtime.ts</code>, <code>bind</code> associates an
        Effect runner and the active middleware with AsyncLocalStorage. The definition's{" "}
        <code>run</code> call retrieves that binding and delegates its Effect to the runner. It
        throws TypeError if no runtime is bound or if any middleware required by the definition is
        inactive. A valid service type is therefore only part of the contract: rendering also needs
        the application's request runtime and the required middleware scope.
      </p>
      <p>
        You can now trace the complete connection: factories describe service requirements, Layers
        and middleware provide values, identity keeps definitions together, and the render runtime
        connects React's calls to Effect execution. Continue with{" "}
        <a href="/en/architecture/implementation/routing">03. Route assembly</a> to see how Routes
        collect the middleware and destinations used by the HTTP layer.{" "}
        <a href="/en/architecture/implementation/request">Request processing</a> follows service
        lifetimes, while <a href="/en/architecture/implementation/rendering">Rendering</a> continues
        across the React boundary.
      </p>
    </>
  ),
};
