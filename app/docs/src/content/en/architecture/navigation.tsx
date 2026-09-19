import { CodeBlock } from "../../../components/code-block";
import { coreRuntimeSources } from "../../core-runtime";
import type { DocPage } from "../../types";

export const page: DocPage = {
  slug: "/architecture/implementation/navigation",
  title: "06. Browser navigation",
  description:
    "Trace a link navigation from Flight loading to React and history commits, and understand when streaming resources can be released or a route cached.",
  section: "Architecture",
  group: "Implementation",
  headings: [
    { id: "browser-start", title: "Establish the first tree and choose client navigation" },
    { id: "flight-load", title: "Load a route or return control to the browser" },
    { id: "transition-commit", title: "Distinguish scheduling a render from committing it" },
    { id: "navigation-lifetime", title: "Cache completed routes and retire obsolete work" },
  ],
  content: () => (
    <>
      <p>
        A client navigation can display its new route before all of that route's Flight data has
        arrived. React committing a tree, the browser committing a history entry, and the response
        stream finishing are separate events. This chapter follows a link navigation through those
        boundaries so you can understand why it falls back to a document load, when Back can reuse a
        route, and how a newer navigation supersedes unfinished work.
      </p>
      <p>
        The starting point is the{" "}
        <a href="/en/architecture/implementation/rendering">Flight embedded in the initial HTML</a>.
        Subsequent responses carry the same{" "}
        <a href="/en/architecture/implementation/routing">
          route-tree model produced by server routing
        </a>
        , but updating an existing React root requires coordination that a fresh document load does
        not.
      </p>
      <h2 id="browser-start">Establish the first tree and choose client navigation</h2>
      <p>
        Before it can replace a route, the browser runtime needs a rendered tree to keep visible
        during the next load. In <code>client/application.ts</code>, <code>activateBrowser</code>{" "}
        loads the initial Flight payload and passes it to <code>ReactDOMRenderer.hydrate</code>.
        Hydration passes <code>formState</code> to React and waits for a layout effect to initialize{" "}
        <code>BrowserRenderer</code> with the initial tree and React's state setter. Only then does
        activation register route refresh, the Server Function callback, and, when supported, the
        client router.
      </p>
      <p>
        Support means that both <code>window.navigation</code> and{" "}
        <code>window.NavigationPrecommitController</code> exist, as checked in{" "}
        <code>client/browser-capabilities.ts</code>. Otherwise, navigation remains a document load
        even though the page is hydrated. With these APIs available, the router still leaves some
        operations to the browser rather than turning every navigation into a Flight request:
      </p>
      <figure data-core-source={coreRuntimeSources.navigationEligibility.path}>
        <figcaption>
          Excerpt from <code>{coreRuntimeSources.navigationEligibility.path}</code>
        </figcaption>
        <CodeBlock
          code={coreRuntimeSources.navigationEligibility.code}
          language={coreRuntimeSources.navigationEligibility.language}
        />
      </figure>
      <p>
        The event must be interceptable and must not be a hash-only change, download, form
        submission, or reload. The two <code>info</code> markers also exclude React-managed
        transitions and Effront's explicit document navigations. In particular, the latter prevents
        a fallback document load from being intercepted again.
      </p>
      <p>
        <code>browserMain</code> keeps the services and subscriptions alive with{" "}
        <code>Effect.scoped</code> and <code>Effect.never</code>. Initial Flight failures and errors
        starting hydration lead to the browser failure screen. Errors during React rendering are
        handled separately by the renderer's Error Boundary.
      </p>
      <h2 id="flight-load">Load a route or return control to the browser</h2>
      <p>
        For an eligible event, <code>client/route-loader.ts</code> first decides whether there is
        anything to fetch. A history traversal can reuse a cached tree by the destination history
        entry's ID. Other navigations, and traversal cache misses, use{" "}
        <code>FlightClient.load</code> to send a GET with <code>Accept: text/x-component</code>. The
        request has its own response scope so its resources can outlive the initial payload decode
        without staying open indefinitely.
      </p>
      <p>
        A response outside the 2xx range or with a non-Flight content type is a{" "}
        <code>Document</code> result for navigation, not a tree to render. The router releases that
        response and starts a document navigation to the requested destination. Transport failures,
        an invalid or missing resolved response URL, and decode failures instead use{" "}
        <code>FlightLoadError</code>, with reasons <code>RequestFailed</code>,{" "}
        <code>UnexpectedResponse</code>, and <code>DecodeFailed</code> respectively. These error
        cases are distinct from the intentional document fallback.
      </p>
      <p>
        A successful Flight result provides the decoded payload together with <code>completed</code>
        , <code>release</code>, and <code>resolvedUrl</code>. The payload can become available while
        deferred data is still streaming, so obtaining a route tree does not imply that{" "}
        <code>completed</code> has succeeded. Keep that distinction in mind when following the cache
        logic below.
      </p>
      <p>
        Before publishing the tree, <code>client/client-router.ts</code> checks the resolved
        destination. A different origin requires a document navigation. A changed URL on the same
        origin also requires document replacement for a traversal or when no precommit controller is
        available. Otherwise, the router can redirect through that controller after React commits.
        The requested hash is preserved only when the resolved URL has no hash and its origin, path,
        and query match the requested URL.
      </p>
      <h2 id="transition-commit">Distinguish scheduling a render from committing it</h2>
      <p>
        Once a tree is ready, the router asks React to render it without treating that request as a
        completed navigation. An asynchronous Transition Action runs the loading work through{" "}
        <code>BrowserEffectRunner</code>, which connects Effects to the native Promise boundary.
        After loading, the following inner transition publishes the tree:
      </p>
      <figure data-core-source={coreRuntimeSources.navigationPublication.path}>
        <figcaption>
          Excerpt from <code>{coreRuntimeSources.navigationPublication.path}</code>
        </figcaption>
        <CodeBlock
          code={coreRuntimeSources.navigationPublication.code}
          language={coreRuntimeSources.navigationPublication.language}
        />
      </figure>
      <p>
        <code>browserRenderer.navigate</code> schedules a React state update and returns three
        lifecycle handles. <code>committed</code> resolves when the renderer acknowledges the tree,{" "}
        <code>retired</code> resolves when a replacement commit no longer retains it, and{" "}
        <code>discard</code> requests restoration of the current tree for a still-pending render and
        waits for retirement. The acknowledgement comes from{" "}
        <code>client/react-dom-renderer.tsx</code>: its layout effect calls{" "}
        <code>browserRenderer.commit(render)</code>. Publishing state alone is not this
        acknowledgement.
      </p>
      <p>
        For cancelable events, the router uses <code>event.intercept</code> with a{" "}
        <code>precommitHandler</code>. It waits for <code>committed</code>, applies any eligible
        redirect, and registers an <code>addHandler</code> callback to record the browser's history
        commit. A non-cancelable traversal uses the ordinary handler instead, so it cannot defer
        history in the same way. If preparation fails on that path, the router reloads the document.
      </p>
      <p>
        The transition types in the excerpt describe navigation kind and, when known, direction.
        Push and replace navigations from links can add <code>data-effront-transition-types</code>{" "}
        values, with duplicates and reserved framework types removed. These labels classify the
        React transition rather than changing the commit or resource-lifetime rules. For
        application-level usage, see{" "}
        <a href="/en/advanced/client-navigation">client navigation and page transitions</a>.
      </p>
      <h2 id="navigation-lifetime">Cache completed routes and retire obsolete work</h2>
      <p>
        Consider clicking a second link while the first destination is still loading or rendering.
        The router represents the pending candidate separately from the visible navigation, with
        candidate states <code>Loading → Publishing → Rendering</code>. Each candidate has a
        generation symbol and an AbortController, allowing a newer navigation to cancel pending work
        without immediately releasing the visible tree's resources.
      </p>
      <p>
        If an obsolete load returns a route, the generation check releases it instead of publishing
        it. If its render has already been scheduled, the router calls <code>discard</code> and
        waits for retirement before releasing the resource. <code>BrowserRenderer</code> retains
        trees still visible or referenced by a pending publication, including a restoration request.
        This is why aborting a navigation and retiring its render are not interchangeable
        operations. Commits of unpublished or retired trees and invalid lifecycle transitions throw
        TypeError as internal invariant violations.
      </p>
      <p>
        For a newly loaded route that becomes visible, caching requires both a committed history
        entry and successful Flight completion. <code>NavigationEntryState</code> and{" "}
        <code>NavigationFlightState</code> track those facts separately because either can arrive
        first:
      </p>
      <ul>
        <li>
          If history commits first, the router waits for the stream before caching and releasing the
          response.
        </li>
        <li>
          If Flight completes first, the router releases the response and retains the cache callback
          until the history entry is known.
        </li>
        <li>If the stream fails, the router releases its resources without caching the route.</li>
      </ul>
      <p>
        Render retirement also releases the resource, even if a newer generation is already current.
        The cache stores route trees, not an obligation to keep their response streams open. In{" "}
        <code>RouteLoader</code>, disposing a history entry removes its cache entry, and refresh
        replaces the cache Map so a delayed callback from an older load cannot repopulate the new
        cache. The{" "}
        <a href="/en/architecture/implementation/server-functions">
          Server Function execution chapter
        </a>{" "}
        follows how a response updates the current page using the same renderer lifecycle.
      </p>
    </>
  ),
};
