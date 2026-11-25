import { manual } from "#fixture/content.ts";
import type { MarkdownEntry } from "@effront/markdown";
import { parseMarkdown } from "@effront/markdown";
import { MarkdownDocument } from "@effront/markdown/document";
import { Context, Effect, Predicate, Result, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { EFFRONT } from "./effront.ts";
import { getWorkersRequestContext } from "./host.ts";
import { ManualShell } from "./manual-shell.tsx";
import { MarkdownHeading } from "./markdown-heading.tsx";

class CurrentEntry extends Context.Service<CurrentEntry, MarkdownEntry>()("e2e/CurrentEntry") {}

const missing = 404;
const loadFailed = 500;
const components = { h1: MarkdownHeading };
const FindEntry = EFFRONT.Middleware.make<{ provides: CurrentEntry }>(
  Effect.fn("FindEntry")(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const collection = yield* Effect.result(manual);
    if (Result.isFailure(collection)) {
      return HttpServerResponse.text("Unable to load Markdown collection", { status: loadFailed });
    }
    const entry = collection.success.get(request.url);
    if (Predicate.isNullish(entry)) {
      return HttpServerResponse.text("Not found", { status: missing });
    }
    return yield* httpEffect.pipe(Effect.provideService(CurrentEntry, entry));
  }),
);
const Manual = EFFRONT.withMiddleware(FindEntry);

const ManualLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.gen(function* () {
      const { request } = yield* getWorkersRequestContext();
      const pathname = new URL(request.url, "http://localhost").pathname.replace(/\/$/u, "");
      return <ManualShell pathname={pathname}>{children}</ManualShell>;
    }),
});

const ManualPage = Manual.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: Effect.fn("ManualPage.render")(function* () {
    const entry = yield* CurrentEntry;
    const document = yield* parseMarkdown(entry);
    return (
      <article className="comark" data-markdown-page={entry.url} data-doc-page={entry.url}>
        <MarkdownDocument value={document} components={components} />
      </article>
    );
  }),
});

export const manualRoutes = Manual.Routes.make({ layout: ManualLayout }).page("/*path", ManualPage);
