import { CodeBlock } from "../../../components/code-block";
import { coreModelSources } from "../../core-model";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/routing",
  title: "03. From routes to requests",
  description:
    "Trace how Routes become server destinations, where invalid declarations are rejected, and when Page parameter validation returns a 404.",
  section: "Architecture",
  group: "Implementation",
  headings: [
    { id: "compilation", title: "Start with the destination the server receives" },
    { id: "route-contract", title: "Connect URL captures to Page input" },
    { id: "collisions", title: "Locate failures during application assembly" },
    { id: "schema-and-http", title: "Separate route matching from parameter validation" },
  ],
  content: () => (
    <>
      <p>
        A request for <code>/items/42</code> needs more than a matching Page: it also needs that
        Page's surrounding layouts and middleware. Effront assembles these into a destination before
        serving requests. This chapter follows that destination back to its route declaration, then
        forward to parameter validation, so you can distinguish an invalid application definition
        from a request that should return a 404.
      </p>
      <h2 id="compilation">Start with the destination the server receives</h2>
      <p>
        <code>Routes</code> describes a tree of Pages and mounted child Routes, not a live HTTP
        matcher. During <code>EFFRONT.make</code>, <code>compileRouteGraph</code> in{" "}
        <code>application/route-graph.ts</code> flattens this tree into the following destinations.
        Each destination carries a complete path pattern, the Page's internal state, its route
        middleware chain, and the Layout/Loading scopes needed to build its UI.
      </p>
      <figure data-core-source={coreModelSources.compiledDestination.path}>
        <figcaption>
          Excerpt from <code>{coreModelSources.compiledDestination.path}</code>
        </figcaption>
        <CodeBlock
          code={coreModelSources.compiledDestination.code}
          language={coreModelSources.compiledDestination.language}
        />
      </figure>
      <p>
        For example, mounting a child Page declared at <code>/:id</code> beneath <code>/items</code>{" "}
        produces the pattern <code>/items/:id</code>. The traversal carries the parent's scopes into
        the child and adds a scope only when the child Routes defines a Layout or Loading component.
        A Routes node used only to group paths therefore creates no extra rendering boundary. Each
        added scope's ID combines the declaration's <code>scopeId</code> with its mounted prefix,
        distinguishing the same declaration mounted at different paths.
      </p>
      <figure data-core-source={coreModelSources.routeTraversal.path}>
        <figcaption>
          Excerpt from <code>{coreModelSources.routeTraversal.path}</code>
        </figcaption>
        <CodeBlock
          code={coreModelSources.routeTraversal.code}
          language={coreModelSources.routeTraversal.language}
        />
      </figure>
      <p>
        Read this loop as a traversal order, not a matching-priority rule. It appends the current
        node's Pages in registration order, then visits its mounts in registration order. Because
        Pages and mounts occupy separate arrays, interleaving <code>page</code> and{" "}
        <code>mount</code> calls does not preserve their combined call order in the graph. The
        compiler does not sort static and dynamic paths here; HTTP matching belongs to Effect HTTP.
      </p>
      <p>
        The traversal also resolves route middleware: <code>resolveRouteMiddleware</code> keeps the
        inherited chain and appends the part of the current declaration beyond their shared prefix.
        Any remaining duplicate middleware in the resolved chain is a <code>TypeError</code>. The
        root must define a Layout and the completed graph must contain at least one Page. With those
        checks satisfied, the compiler returns a frozen, nonempty destination array that the server
        can use without walking the Routes tree for each request.
      </p>
      <h2 id="route-contract">Connect URL captures to Page input</h2>
      <p>
        To understand what can enter that graph, look at <code>application/routes.ts</code>. Each{" "}
        <code>page</code> or <code>mount</code> call returns a new Routes definition rather than
        mutating the original. <code>RoutesDefinition</code> tracks whether a Layout exists, which
        paths have been registered, and their matching shapes, allowing later calls to check
        additions against the definition built so far.
      </p>
      <p>
        For <code>/items/:id</code>, <code>MatchingPageParams</code> requires a parameterized Page
        whose Schema has the encoded key <code>id</code>. The path names match the Schema's{" "}
        <code>Encoded</code> keys, while Page rendering receives its decoded <code>Type</code>. A
        Schema may therefore transform the captured value or rename an output key without changing
        the URL's parameter name. Static paths instead require a Page without a parameter Schema.
      </p>
      <p>
        These type checks complement runtime checks, rather than duplicating them exactly. Runtime
        registration verifies path syntax, that the Page belongs to the same EFFRONT instance, and
        that the presence of route parameters agrees with the presence of a Schema. It does not
        repeat the type-level comparison of every parameter name with the Schema's encoded keys.
      </p>
      <p>
        Path syntax is paired in <code>ValidRoutePath</code> and <code>analyzeRoutePath</code> in{" "}
        <code>application/route-path.ts</code>. A declaration starts with <code>/</code>, uses{" "}
        <code>:id</code> for a named segment, and may end with a named catch-all such as{" "}
        <code>*path</code>. Apart from the root <code>/</code>, empty segments and trailing slashes
        are invalid, as are dot segments, repeated parameter names, query strings, and wildcards
        outside the terminal catch-all form. A mount prefix must be static, and its child Routes
        must be nonempty and belong to the same EFFRONT instance.
      </p>
      <h2 id="collisions">Locate failures during application assembly</h2>
      <p>
        A valid path can still conflict with one already registered. Effront compares matching
        shapes: static segments are lowercased and parameter names are removed from the shape. These
        examples show what that comparison rejects, without implying that every overlap between
        patterns is forbidden:
      </p>
      <ul>
        <li>
          <code>/items/:id</code> and <code>/items/:slug</code> collide because changing the
          parameter name does not change the shape.
        </li>
        <li>
          <code>/About</code> and <code>/about</code> collide because case is ignored in the shape.
        </li>
        <li>
          <code>/manual/*path</code> also reserves <code>/manual</code>, where the catch-all can
          capture an empty string.
        </li>
        <li>
          <code>/items/new</code> and <code>/items/:id</code> have different shapes, so this check
          permits them together.
        </li>
      </ul>
      <p>
        Mounting checks the child's paths after joining them to the prefix, so a mounted Page can
        collide with a Page registered directly on the parent. <code>joinRoutePaths</code> treats{" "}
        <code>/</code> specially to avoid adding an extra slash. The type-level shape checks have
        runtime counterparts that throw <code>TypeError</code>.
      </p>
      <p>
        The compiler then checks the final, joined paths with <code>validateUnreservedPath</code> to
        protect <code>/_effront</code>. It rejects a first segment equal to <code>_effront</code>{" "}
        regardless of case, as well as a dynamic first segment that could capture that namespace.
        Thus <code>/:slug</code> cannot be a final application path, while <code>/items/:slug</code>{" "}
        passes this reserved-namespace check. These are application-assembly errors, not HTTP
        responses to incoming URLs.
      </p>
      <h2 id="schema-and-http">Separate route matching from parameter validation</h2>
      <p>
        Once assembly succeeds, <code>makeRouteLayer</code> in <code>server/application.ts</code>{" "}
        registers GET and POST handlers for each destination through <code>HttpRouter.add</code>.
        Effect HTTP matches the URL and decodes its captures. For a catch-all, Effront only moves
        the router's <code>*</code> capture to the declared parameter name and supplies an empty
        string when the capture is absent. The render path reads these values through{" "}
        <code>HttpRouter.params</code> before applying the Page Schema.
      </p>
      <figure data-core-source={coreModelSources.parameterValidation.path}>
        <figcaption>
          Excerpt from <code>{coreModelSources.parameterValidation.path}</code>
        </figcaption>
        <CodeBlock
          code={coreModelSources.parameterValidation.code}
          language={coreModelSources.parameterValidation.language}
        />
      </figure>
      <p>
        For a non-POST request to a parameterized Page, a typed Schema decoding failure produces an
        empty 404 response with <code>private, no-store</code> cache control. If decoding succeeds,
        the <code>Decoded</code> tag lets the Page component pass the value to its render function
        without decoding it again. For example, <code>/items/not-a-number</code> may match{" "}
        <code>/items/:id</code> yet return this 404 if the Page Schema requires an ID that decodes
        to a number.
      </p>
      <p>
        Keep that result separate from an unmatched route or a failure while reading URL captures:
        those occur outside this Schema failure handler. Nor does the same prevalidation apply to
        POST. When a POST reaches rendering, it passes <code>Encoded</code> parameters, and the Page
        component performs any required decoding. Server Function inputs and refresh behavior
        therefore need their own error analysis, rather than inheriting the GET Schema-to-404 rule.
      </p>
      <p>
        You can now locate a routing problem at declaration, graph assembly, HTTP matching, or Page
        parameter validation. Continue with{" "}
        <a href="/en/architecture/implementation/request">request processing</a> to follow the
        request's Context and lifetime, or{" "}
        <a href="/en/architecture/implementation/rendering">rendering</a> to see how destination
        scopes become UI. The{" "}
        <a href="/en/architecture/implementation/server-functions">Server Functions</a> chapter
        follows the POST-specific path.
      </p>
    </>
  ),
};
