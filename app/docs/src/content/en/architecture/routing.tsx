import type { ReactNode } from "react";

import { renderArticleList } from "#docs/content/core-article-list.tsx";
import { coreModelSources } from "#docs/content/core-model.tsx";
import { SourceExcerpt } from "#docs/content/core-source.tsx";
import type { DocPage } from "#docs/content/types.ts";

const renderIntroduction = (): ReactNode => (
  <p>
    A destination combines a Page with its full path, middleware, and surrounding Layout/Loading
    scopes. Effront assembles destinations before it serves requests. This separates invalid
    declarations from URLs that match a route but fail Page parameter validation.
  </p>
);

const renderCompilation = (): ReactNode => (
  <>
    <h2 id="compilation">Start with the destination the server receives</h2>
    <p>
      <code>Routes</code> is a tree of Pages and mounted child Routes, not a live HTTP matcher.
      During <code>EFFRONT.make</code>, <code>compileRouteGraph</code> in{" "}
      <code>application/route-graph.ts</code> flattens it into destinations:
    </p>
    <SourceExcerpt locale="en" source={coreModelSources.compiledDestination} />
    <p>
      Mounting a child Page at <code>/:id</code> beneath <code>/items</code> produces{" "}
      <code>/items/:id</code>. The traversal inherits the parent&apos;s scopes and adds one only
      when the child Routes defines Layout or Loading. Grouping paths alone creates no rendering
      boundary. Each scope ID combines the declaration&apos;s <code>scopeId</code> with its mounted
      prefix, distinguishing repeated mounts.
    </p>
    <SourceExcerpt locale="en" source={coreModelSources.routeTraversal} />
    <p>
      The loop visits the current node&apos;s Pages, then its mounts, each in registration order.
      Interleaved <code>page</code> and <code>mount</code> calls therefore do not retain a combined
      order. This is traversal order, not matching priority. Effect HTTP owns matching, and this
      compiler does not sort static and dynamic paths.
    </p>
    <p>
      <code>resolveRouteMiddleware</code> retains the inherited chain and appends the current
      declaration&apos;s suffix after their shared prefix. Remaining duplicates throw{" "}
      <code>TypeError</code>. The compiler also requires a root Layout and at least one Page. It
      then returns a frozen, nonempty destination array. Requests use that array without a new
      traversal of Routes.
    </p>
  </>
);

const renderRouteContractList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          Paths start with <code>/</code>, use named segments such as <code>:id</code>, and may end
          with a named catch-all such as <code>*path</code>.
        </>
      ),
      id: "segments",
    },
    {
      content: (
        <>
          Except for root <code>/</code>, empty segments and trailing slashes are invalid. Dot
          segments, repeated parameter names, query strings, and other wildcard forms are also
          invalid.
        </>
      ),
      id: "invalid-paths",
    },
    {
      content: (
        <>
          Mount prefixes must be static. Child Routes must be nonempty and share the application
          identity.
        </>
      ),
      id: "mounts",
    },
  ]);

const renderRouteContract = (): ReactNode => (
  <>
    <h2 id="route-contract">Connect URL captures to Page input</h2>
    <p>
      In <code>application/routes.ts</code>, <code>page</code> and <code>mount</code> return new
      definitions rather than mutating existing ones. <code>RoutesDefinition</code> tracks Layout
      presence, registered paths, and matching shapes so later additions can be checked against
      earlier ones.
    </p>
    <p>
      <code>MatchingPageParams</code> compares URL parameter names with the Page Schema&apos;s{" "}
      <code>Encoded</code> keys. For <code>/items/:id</code>, the Schema must have exactly the
      encoded key <code>id</code>, while rendering receives the decoded <code>Type</code>. A
      transformation can change the value or output key without changing the URL parameter name.
      Static paths require a Page without a parameter Schema.
    </p>
    <p>
      Runtime registration checks syntax, application identity, and agreement between the presence
      of parameters and a Schema. It does not repeat the type-level comparison of all encoded keys.
    </p>
    <p>
      <code>ValidRoutePath</code> and <code>analyzeRoutePath</code> in{" "}
      <code>application/route-path.ts</code> pair type-level and runtime grammar checks:
    </p>
    {renderRouteContractList()}
  </>
);

const renderCollisionsList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <code>/items/:id</code> and <code>/items/:slug</code> collide.
        </>
      ),
      id: "parameters",
    },
    {
      content: (
        <>
          <code>/About</code> and <code>/about</code> collide.
        </>
      ),
      id: "letter-case",
    },
    {
      content: (
        <>
          <code>/manual/*path</code> also reserves <code>/manual</code>, where its capture is empty.
        </>
      ),
      id: "catch-all",
    },
    {
      content: (
        <>
          <code>/items/new</code> and <code>/items/:id</code> have different shapes and can coexist.
        </>
      ),
      id: "static-and-dynamic",
    },
  ]);

const renderCollisions = (): ReactNode => (
  <>
    <h2 id="collisions">Locate failures during application assembly</h2>
    <p>
      Collision checks lowercase static segments and remove parameter names to compare matching
      shapes. They reject equivalent shapes, not every overlap:
    </p>
    {renderCollisionsList()}
    <p>
      Mounts check child paths after joining the prefix, so they can collide with Pages registered
      directly on the parent. <code>joinRoutePaths</code> treats <code>/</code> specially to avoid
      an extra slash. Runtime collision checks throw <code>TypeError</code>. They supplement the
      type checks.
    </p>
    <p>
      <code>validateUnreservedPath</code> checks final joined paths to protect{" "}
      <code>/_effront</code>. It rejects a first segment equal to <code>_effront</code> in any case,
      or a dynamic first segment that could capture it. Thus <code>/:slug</code> is invalid as a
      final application path, while <code>/items/:slug</code> passes this check. These failures
      occur during assembly, before an incoming URL is matched.
    </p>
  </>
);

const renderSchemaAndHttp = (): ReactNode => (
  <>
    <h2 id="schema-and-http">Separate route matching from parameter validation</h2>
    <p>
      <code>makeRouteLayer</code> in <code>server/application.ts</code> registers GET and POST
      handlers through <code>HttpRouter.add</code>. Effect HTTP matches URLs and decodes captures.
      Effront renames its <code>*</code> capture to the declared catch-all name, using an empty
      string if absent. Rendering then reads <code>HttpRouter.params</code> and applies the Page
      Schema:
    </p>
    <SourceExcerpt locale="en" source={coreModelSources.parameterValidation} />
    <p>
      For non-POST requests, a typed Schema decoding failure returns an empty 404 with{" "}
      <code>private, no-store</code>. Success passes <code>Decoded</code> parameters to the Page so
      it does not decode twice. For example, <code>/items/not-a-number</code> can match{" "}
      <code>/items/:id</code> but fail a Schema that decodes the ID to a number.
    </p>
    <p>
      Unmatched routes and failures reading URL captures occur outside this Schema handler. POST
      also bypasses it: rendering receives <code>Encoded</code> parameters, and the Page component
      decodes them. The GET Schema-to-404 rule therefore does not describe Server Function input or
      refresh failures.
    </p>
    <p>
      <a href="/en/architecture/implementation/request">Request processing</a> follows the selected
      destination&apos;s Context and lifetime.{" "}
      <a href="/en/architecture/implementation/rendering">Rendering</a> turns its scopes into UI,
      while <a href="/en/architecture/implementation/server-functions">Server Functions</a> follows
      the POST path.
    </p>
  </>
);

const renderArticle = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderCompilation()}
    {renderRouteContract()}
    {renderCollisions()}
    {renderSchemaAndHttp()}
  </>
);

export const page = {
  content: renderArticle,
  description: "How route definitions become request destinations and validated page parameters.",
  group: "Implementation",
  headings: [
    { id: "compilation", title: "Start with the destination the server receives" },
    { id: "route-contract", title: "Connect URL captures to Page input" },
    { id: "collisions", title: "Locate failures during application assembly" },
    { id: "schema-and-http", title: "Separate route matching from parameter validation" },
  ],
  section: "Architecture",
  slug: "/architecture/implementation/routing",
  title: "03. From routes to requests",
} satisfies DocPage;
