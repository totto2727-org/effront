import { Application } from "@effront/core";
import { Effect, Layer } from "effect";

import { getPage } from "./content/pages.ts";
import { renderDocsLayout, renderDocsPage } from "./docs-page-view.tsx";
import { RequestPath, RequestPathLive, RetiredArticleRedirects } from "./docs-request.ts";
import { responseCache } from "./response-cache.ts";

const EFFRONT = Application.effront<RequestPath>();
const ResponseCache = EFFRONT.Middleware.make(responseCache);
const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.map(RequestPath, (pathname) => renderDocsLayout(pathname, children)),
});

const documentPage = (slug: string): ReturnType<typeof EFFRONT.Page.make> => {
  const page = getPage(slug);
  return EFFRONT.Page.make({
    render: () => Effect.map(page.content(), (content) => renderDocsPage(page, content)),
  });
};

// Explicit routes preserve Effront's compile-time collision checks and its native 404 handling.
const application = EFFRONT.make({
  layer: Layer.mergeAll(RequestPathLive, RetiredArticleRedirects),
  routes: EFFRONT.withMiddleware(ResponseCache)
    .Routes.make({ layout: RootLayout })
    .page("/", documentPage("/"))
    .page("/guide/getting-started", documentPage("/guide/getting-started"))
    .page("/guide/routes", documentPage("/guide/routes"))
    .page("/guide/components", documentPage("/guide/components"))
    .page("/guide/effect", documentPage("/guide/effect"))
    .page("/platforms", documentPage("/platforms"))
    .page("/platforms/node", documentPage("/platforms/node"))
    .page("/platforms/bun", documentPage("/platforms/bun"))
    .page("/platforms/alchemy", documentPage("/platforms/alchemy"))
    .page("/guide/markdown", documentPage("/guide/markdown"))
    .page("/guide/styling", documentPage("/guide/styling"))
    .page("/api-reference/http", documentPage("/api-reference/http"))
    .page("/api-reference/server", documentPage("/api-reference/server"))
    .page("/api-reference/markdown", documentPage("/api-reference/markdown"))
    .page("/api-reference/alchemy", documentPage("/api-reference/alchemy"))
    .page("/api-reference/tailwind", documentPage("/api-reference/tailwind"))
    .page("/platforms/cloudflare", documentPage("/platforms/cloudflare"))
    .page(
      "/best-practices/authentication-and-authorization",
      documentPage("/best-practices/authentication-and-authorization"),
    )
    .page(
      "/best-practices/server-function-error-handling",
      documentPage("/best-practices/server-function-error-handling"),
    )
    .page("/best-practices/testing", documentPage("/best-practices/testing"))
    .page("/guide/server-functions", documentPage("/guide/server-functions"))
    .page("/guide/mutation-server-functions", documentPage("/guide/mutation-server-functions"))
    .page("/guide/query-server-functions", documentPage("/guide/query-server-functions"))
    .page("/guide/stream-server-functions", documentPage("/guide/stream-server-functions"))
    .page("/guide/middleware", documentPage("/guide/middleware"))
    .page("/guide/http", documentPage("/guide/http"))
    .page(
      "/advanced/request-runtime-and-lifetimes",
      documentPage("/advanced/request-runtime-and-lifetimes"),
    )
    .page("/advanced/client-navigation", documentPage("/advanced/client-navigation"))
    .page(
      "/advanced/server-function-execution-and-refresh",
      documentPage("/advanced/server-function-execution-and-refresh"),
    )
    .page("/api-reference", documentPage("/api-reference"))
    .page("/api-reference/application", documentPage("/api-reference/application"))
    .page("/api-reference/components", documentPage("/api-reference/components"))
    .page("/api-reference/routing", documentPage("/api-reference/routing"))
    .page("/api-reference/server-functions", documentPage("/api-reference/server-functions"))
    .page("/api-reference/workers", documentPage("/api-reference/workers"))
    .page("/api-reference/vite", documentPage("/api-reference/vite"))
    .page(
      "/architecture/implementation/overview",
      documentPage("/architecture/implementation/overview"),
    )
    .page(
      "/architecture/implementation/application",
      documentPage("/architecture/implementation/application"),
    )
    .page(
      "/architecture/implementation/routing",
      documentPage("/architecture/implementation/routing"),
    )
    .page(
      "/architecture/implementation/request",
      documentPage("/architecture/implementation/request"),
    )
    .page(
      "/architecture/implementation/rendering",
      documentPage("/architecture/implementation/rendering"),
    )
    .page(
      "/architecture/implementation/navigation",
      documentPage("/architecture/implementation/navigation"),
    )
    .page(
      "/architecture/implementation/server-functions",
      documentPage("/architecture/implementation/server-functions"),
    )
    .page("/ja", documentPage("/ja"))
    .page("/ja/guide/getting-started", documentPage("/ja/guide/getting-started"))
    .page("/ja/guide/routes", documentPage("/ja/guide/routes"))
    .page("/ja/guide/components", documentPage("/ja/guide/components"))
    .page("/ja/guide/effect", documentPage("/ja/guide/effect"))
    .page("/ja/platforms", documentPage("/ja/platforms"))
    .page("/ja/platforms/node", documentPage("/ja/platforms/node"))
    .page("/ja/platforms/bun", documentPage("/ja/platforms/bun"))
    .page("/ja/platforms/alchemy", documentPage("/ja/platforms/alchemy"))
    .page("/ja/guide/markdown", documentPage("/ja/guide/markdown"))
    .page("/ja/guide/styling", documentPage("/ja/guide/styling"))
    .page("/ja/api-reference/http", documentPage("/ja/api-reference/http"))
    .page("/ja/api-reference/server", documentPage("/ja/api-reference/server"))
    .page("/ja/api-reference/markdown", documentPage("/ja/api-reference/markdown"))
    .page("/ja/api-reference/alchemy", documentPage("/ja/api-reference/alchemy"))
    .page("/ja/api-reference/tailwind", documentPage("/ja/api-reference/tailwind"))
    .page("/ja/platforms/cloudflare", documentPage("/ja/platforms/cloudflare"))
    .page(
      "/ja/best-practices/authentication-and-authorization",
      documentPage("/ja/best-practices/authentication-and-authorization"),
    )
    .page(
      "/ja/best-practices/server-function-error-handling",
      documentPage("/ja/best-practices/server-function-error-handling"),
    )
    .page("/ja/best-practices/testing", documentPage("/ja/best-practices/testing"))
    .page("/ja/guide/server-functions", documentPage("/ja/guide/server-functions"))
    .page(
      "/ja/guide/mutation-server-functions",
      documentPage("/ja/guide/mutation-server-functions"),
    )
    .page("/ja/guide/query-server-functions", documentPage("/ja/guide/query-server-functions"))
    .page("/ja/guide/stream-server-functions", documentPage("/ja/guide/stream-server-functions"))
    .page("/ja/guide/middleware", documentPage("/ja/guide/middleware"))
    .page("/ja/guide/http", documentPage("/ja/guide/http"))
    .page(
      "/ja/advanced/request-runtime-and-lifetimes",
      documentPage("/ja/advanced/request-runtime-and-lifetimes"),
    )
    .page("/ja/advanced/client-navigation", documentPage("/ja/advanced/client-navigation"))
    .page(
      "/ja/advanced/server-function-execution-and-refresh",
      documentPage("/ja/advanced/server-function-execution-and-refresh"),
    )
    .page("/ja/api-reference", documentPage("/ja/api-reference"))
    .page("/ja/api-reference/application", documentPage("/ja/api-reference/application"))
    .page("/ja/api-reference/components", documentPage("/ja/api-reference/components"))
    .page("/ja/api-reference/routing", documentPage("/ja/api-reference/routing"))
    .page("/ja/api-reference/server-functions", documentPage("/ja/api-reference/server-functions"))
    .page("/ja/api-reference/workers", documentPage("/ja/api-reference/workers"))
    .page("/ja/api-reference/vite", documentPage("/ja/api-reference/vite"))
    .page(
      "/ja/architecture/implementation/overview",
      documentPage("/ja/architecture/implementation/overview"),
    )
    .page(
      "/ja/architecture/implementation/application",
      documentPage("/ja/architecture/implementation/application"),
    )
    .page(
      "/ja/architecture/implementation/routing",
      documentPage("/ja/architecture/implementation/routing"),
    )
    .page(
      "/ja/architecture/implementation/request",
      documentPage("/ja/architecture/implementation/request"),
    )
    .page(
      "/ja/architecture/implementation/rendering",
      documentPage("/ja/architecture/implementation/rendering"),
    )
    .page(
      "/ja/architecture/implementation/navigation",
      documentPage("/ja/architecture/implementation/navigation"),
    )
    .page(
      "/ja/architecture/implementation/server-functions",
      documentPage("/ja/architecture/implementation/server-functions"),
    )
    .page("/en", documentPage("/en"))
    .page("/en/guide/getting-started", documentPage("/en/guide/getting-started"))
    .page("/en/guide/routes", documentPage("/en/guide/routes"))
    .page("/en/guide/components", documentPage("/en/guide/components"))
    .page("/en/guide/effect", documentPage("/en/guide/effect"))
    .page("/en/platforms", documentPage("/en/platforms"))
    .page("/en/platforms/node", documentPage("/en/platforms/node"))
    .page("/en/platforms/bun", documentPage("/en/platforms/bun"))
    .page("/en/platforms/alchemy", documentPage("/en/platforms/alchemy"))
    .page("/en/guide/markdown", documentPage("/en/guide/markdown"))
    .page("/en/guide/styling", documentPage("/en/guide/styling"))
    .page("/en/api-reference/http", documentPage("/en/api-reference/http"))
    .page("/en/api-reference/server", documentPage("/en/api-reference/server"))
    .page("/en/api-reference/markdown", documentPage("/en/api-reference/markdown"))
    .page("/en/api-reference/alchemy", documentPage("/en/api-reference/alchemy"))
    .page("/en/api-reference/tailwind", documentPage("/en/api-reference/tailwind"))
    .page("/en/platforms/cloudflare", documentPage("/en/platforms/cloudflare"))
    .page(
      "/en/best-practices/authentication-and-authorization",
      documentPage("/en/best-practices/authentication-and-authorization"),
    )
    .page(
      "/en/best-practices/server-function-error-handling",
      documentPage("/en/best-practices/server-function-error-handling"),
    )
    .page("/en/best-practices/testing", documentPage("/en/best-practices/testing"))
    .page("/en/guide/server-functions", documentPage("/en/guide/server-functions"))
    .page(
      "/en/guide/mutation-server-functions",
      documentPage("/en/guide/mutation-server-functions"),
    )
    .page("/en/guide/query-server-functions", documentPage("/en/guide/query-server-functions"))
    .page("/en/guide/stream-server-functions", documentPage("/en/guide/stream-server-functions"))
    .page("/en/guide/middleware", documentPage("/en/guide/middleware"))
    .page("/en/guide/http", documentPage("/en/guide/http"))
    .page(
      "/en/advanced/request-runtime-and-lifetimes",
      documentPage("/en/advanced/request-runtime-and-lifetimes"),
    )
    .page("/en/advanced/client-navigation", documentPage("/en/advanced/client-navigation"))
    .page(
      "/en/advanced/server-function-execution-and-refresh",
      documentPage("/en/advanced/server-function-execution-and-refresh"),
    )
    .page("/en/api-reference", documentPage("/en/api-reference"))
    .page("/en/api-reference/application", documentPage("/en/api-reference/application"))
    .page("/en/api-reference/components", documentPage("/en/api-reference/components"))
    .page("/en/api-reference/routing", documentPage("/en/api-reference/routing"))
    .page("/en/api-reference/server-functions", documentPage("/en/api-reference/server-functions"))
    .page("/en/api-reference/workers", documentPage("/en/api-reference/workers"))
    .page("/en/api-reference/vite", documentPage("/en/api-reference/vite"))
    .page(
      "/en/architecture/implementation/overview",
      documentPage("/en/architecture/implementation/overview"),
    )
    .page(
      "/en/architecture/implementation/application",
      documentPage("/en/architecture/implementation/application"),
    )
    .page(
      "/en/architecture/implementation/routing",
      documentPage("/en/architecture/implementation/routing"),
    )
    .page(
      "/en/architecture/implementation/request",
      documentPage("/en/architecture/implementation/request"),
    )
    .page(
      "/en/architecture/implementation/rendering",
      documentPage("/en/architecture/implementation/rendering"),
    )
    .page(
      "/en/architecture/implementation/navigation",
      documentPage("/en/architecture/implementation/navigation"),
    )
    .page(
      "/en/architecture/implementation/server-functions",
      documentPage("/en/architecture/implementation/server-functions"),
    ),
});

// oxlint-disable-next-line import/no-default-export -- Effront loads the application through this entrypoint default.
export default application;
