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
        React commit, browser history commit, and Flight completion are separate events. A route can
        become visible while deferred data is still streaming, so navigation must track both the
        visible tree and its unfinished resources.
      </p>
      <p>
        Hydration starts from{" "}
        <a href="/en/architecture/implementation/rendering">Flight embedded in HTML</a>. Later
        responses carry the same{" "}
        <a href="/en/architecture/implementation/routing">server-generated route-tree model</a>, but
        update the existing React root rather than creating a document.
      </p>
      <h2 id="browser-start">Establish the first tree and choose client navigation</h2>
      <p>
        <code>activateBrowser</code> in <code>client/application.ts</code> loads the initial Flight
        payload and calls <code>ReactDOMRenderer.hydrate</code>. Hydration passes{" "}
        <code>formState</code> to React and waits for a layout effect to initialize{" "}
        <code>BrowserRenderer</code> with the tree and state setter. Only then are refresh, the
        Server Function callback, and any supported client router installed.
      </p>
      <p>
        <code>client/browser-capabilities.ts</code> selects client routing only when both{" "}
        <code>window.navigation</code> and <code>window.NavigationPrecommitController</code> exist.
        Otherwise, the hydrated page keeps document navigation. Even with both APIs, some events
        stay with the browser:
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
        Interception excludes hash-only changes, downloads, forms, reloads, and the two marked
        navigation types. The document marker prevents Effront's fallback loads from being
        intercepted again.
      </p>
      <p>
        <code>browserMain</code> uses <code>Effect.scoped</code> and <code>Effect.never</code> to
        retain services and subscriptions. Initial Flight and hydration-start failures show the
        browser failure screen. React rendering errors belong to the renderer's Error Boundary.
      </p>
      <h2 id="flight-load">Load a route or return control to the browser</h2>
      <p>
        <code>client/route-loader.ts</code> reuses cached trees for history traversals by
        destination entry ID. Other navigations and cache misses call <code>FlightClient.load</code>{" "}
        with a GET and <code>Accept: text/x-component</code>. Each response has its own Scope, which
        can outlive the initial payload decode.
      </p>
      <ul>
        <li>
          <strong>Document fallback:</strong> a non-2xx or non-Flight response becomes a{" "}
          <code>Document</code> result. The router releases it and starts a document load at the
          requested destination.
        </li>
        <li>
          <strong>Load error:</strong> transport failure, a missing or invalid resolved URL, and
          decode failure produce <code>FlightLoadError</code> with <code>RequestFailed</code>,{" "}
          <code>UnexpectedResponse</code>, and <code>DecodeFailed</code>, respectively.
        </li>
        <li>
          <strong>Flight:</strong> the result includes the payload, <code>completed</code>,{" "}
          <code>release</code>, and <code>resolvedUrl</code>. A decoded route tree does not mean the
          stream has completed.
        </li>
      </ul>
      <p>
        Before publication, <code>client/client-router.ts</code> checks the resolved destination. A
        different origin requires document navigation. A changed same-origin URL requires document
        replacement for traversal or when no precommit controller is available. Otherwise, that
        controller can redirect after React commits. The requested hash survives only if the
        resolved URL lacks a hash and has the same origin, path, and query.
      </p>
      <h2 id="transition-commit">Distinguish scheduling a render from committing it</h2>
      <p>
        An asynchronous Transition Action loads the route through <code>BrowserEffectRunner</code>.
        After loading, an inner transition publishes the tree, but publication is not commit:
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
        <code>browserRenderer.navigate</code> schedules a state update and returns three lifecycle
        handles:
      </p>
      <ul>
        <li>
          <code>committed</code> resolves when a layout effect in{" "}
          <code>client/react-dom-renderer.tsx</code> calls{" "}
          <code>browserRenderer.commit(render)</code>.
        </li>
        <li>
          <code>retired</code> resolves when a replacement commit no longer retains the tree.
        </li>
        <li>
          <code>discard</code> requests restoration of the current tree for a pending render and
          waits for retirement.
        </li>
      </ul>
      <p>
        For cancelable events, <code>event.intercept</code> uses a <code>precommitHandler</code>. It
        waits for React commit, applies any eligible redirect, and registers an{" "}
        <code>addHandler</code> callback to record history commit. Non-cancelable traversals use the
        ordinary handler, which cannot defer history this way. Preparation failure on that path
        reloads the document.
      </p>
      <p>
        Transition types describe navigation kind and direction when known. Link-driven push and
        replace can add <code>data-effront-transition-types</code> values after duplicate and
        reserved-type filtering. These labels do not change commit or lifetime rules. Application
        usage belongs to{" "}
        <a href="/en/advanced/client-navigation">client navigation and page transitions</a>.
      </p>
      <h2 id="navigation-lifetime">Cache completed routes and retire obsolete work</h2>
      <p>
        A pending candidate moves through <code>Loading → Publishing → Rendering</code>, separately
        from the visible navigation. Its generation symbol and AbortController let a newer
        navigation cancel pending work without immediately releasing the visible tree.
      </p>
      <p>
        An obsolete load is released rather than published. An already-scheduled render is
        discarded, then released after retirement. <code>BrowserRenderer</code> retains trees that
        are visible or referenced by pending publications, including restoration requests. Aborting
        navigation is therefore not equivalent to retiring a render. Unpublished or retired commits
        and invalid lifecycle transitions throw <code>TypeError</code>.
      </p>
      <p>
        A newly loaded visible route is cached only after both history commit and successful Flight
        completion. <code>NavigationEntryState</code> and <code>NavigationFlightState</code> track
        these independently:
      </p>
      <ul>
        <li>
          <strong>History first:</strong> wait for Flight, then cache and release.
        </li>
        <li>
          <strong>Flight first:</strong> release the response and retain the cache callback until
          the history entry is known.
        </li>
        <li>
          <strong>Stream failure:</strong> release without caching.
        </li>
      </ul>
      <p>
        Render retirement also releases its resource, even after a newer generation starts. The
        cache holds trees, not open response streams. <code>RouteLoader</code> evicts disposed
        history entries and replaces the cache Map on refresh, preventing delayed callbacks from
        repopulating the new cache.{" "}
        <a href="/en/architecture/implementation/server-functions">Server Function responses</a> use
        the same renderer lifecycle to update the current page.
      </p>
    </>
  ),
};
