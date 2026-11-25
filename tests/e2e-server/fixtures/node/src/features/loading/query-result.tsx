import { useSuspenseQuery } from "@tanstack/react-query";
import { Data, Effect, Predicate } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { useCallback } from "react";
import type { JSX } from "react";

import { utcTimeText } from "./utc-time.ts";

const successStatusStart = 200;
const redirectStatusStart = 300;

class LoadingQueryResponseError extends Data.TaggedError("LoadingQueryResponseError")<{
  message: string;
}> {}

const fetchQuery = Effect.fn("LoadingQuery.fetch")(function* (item: number) {
  // The browser event starts this delay so the actual fetch remains easy to observe.
  yield* Effect.sleep("2 seconds");
  const url = new URL("/loading-query.txt", globalThis.location.href);
  url.searchParams.set("item", String(item));
  const response = yield* HttpClient.get(url);
  if (response.status < successStatusStart || response.status >= redirectStatusStart) {
    return yield* new LoadingQueryResponseError({
      message: `取得失敗: HTTP ${response.status}`,
    });
  }
  return yield* response.text;
});

const loadQuery = async (item: number): Promise<string> => {
  const request = fetchQuery(item).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.RequestInit, { cache: "no-store" }),
  );
  // oxlint-disable-next-line rules/no-effect-runtime-run -- TanStack Query owns this independent browser query invocation.
  return Effect.runPromise(request);
};

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function QueryResult({ item }: Readonly<{ item: number }>): JSX.Element {
  const { data, dataUpdatedAt, error, isFetching, refetch } = useSuspenseQuery({
    queryFn: async () => loadQuery(item),
    queryKey: ["loading-playground", item],
  });
  const refresh = useCallback(() => {
    // oxlint-disable-next-line promise/prefer-await-to-then -- This synchronous React event delegates failures to the TanStack query state.
    refetch().catch(() => {
      // The query reports failed refetches while preserving the last successful data.
    });
  }, [refetch]);

  return (
    <div className="my-3 rounded bg-emerald-100 p-3">
      <p data-testid="query-result">
        項目 {item}：{data}
      </p>
      <p data-testid="query-updated-at" data-updated-at={dataUpdatedAt} className="my-2 text-sm">
        ブラウザー取得完了 UTC：{utcTimeText(dataUpdatedAt)}
      </p>
      <output className="block">
        {isFetching ? "バックグラウンド再取得中：キャッシュを表示" : "取得完了"}
      </output>
      {Predicate.isNotNullish(error) && (
        <p role="alert">再取得に失敗しました。表示済みデータは保持しています。</p>
      )}
      <button
        type="button"
        className="mt-3 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={isFetching}
        onClick={refresh}
      >
        同じキーを再取得（2秒）
      </button>
    </div>
  );
}
