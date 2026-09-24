"use client";

import { QueryClient, QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState, useTransition } from "react";

function QueryResult({ item }: { readonly item: number }) {
  const { data, dataUpdatedAt, isFetching, error, refetch } = useSuspenseQuery({
    queryKey: ["loading-playground", item],
    queryFn: async () => {
      // Only mounted by a browser event. This delay makes the real fetch easy to observe.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 2_000));
      const response = await fetch(`/loading-query.txt?item=${item}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`取得失敗: HTTP ${response.status}`);
      return response.text();
    },
  });

  return (
    <div className="my-3 rounded bg-emerald-100 p-3">
      <p data-testid="query-result">
        項目 {item}：{data}
      </p>
      <p data-testid="query-updated-at" data-updated-at={dataUpdatedAt} className="my-2 text-sm">
        ブラウザー取得完了 UTC：{new Date(dataUpdatedAt).toISOString().slice(11, 23)}
      </p>
      <p role="status">{isFetching ? "バックグラウンド再取得中：キャッシュを表示" : "取得完了"}</p>
      {error && <p role="alert">再取得に失敗しました。表示済みデータは保持しています。</p>}
      <button
        className="mt-3 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={isFetching}
        onClick={() => {
          void refetch();
        }}
      >
        同じキーを再取得（2秒）
      </button>
    </div>
  );
}

export function QueryDemo() {
  // This owner never suspends: the boundary below protects the client on initial retries.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity, retry: false } },
      }),
  );
  const [started, setStarted] = useState(false);
  const [item, setItem] = useState(1);
  const [isPending, startTransition] = useTransition();

  return (
    <section aria-label="TanStack Query 実験">
      <h2 className="text-xl font-bold">子が取得する useSuspenseQuery（各2秒）</h2>
      <p className="my-3">
        親は項目番号だけを渡し、子が queryKey と queryFn を持ちます。Promise props はありません。
        「use client」だけでは SSR を防げないため、「開始」を押すまで子を描画しません。
        取得はブラウザーだけで始まります。
      </p>
      <p className="my-3">
        同じホストの静的テキストを fetch
        します。観察用にブラウザーで2秒待ち、項目が変わっても本文は同じです。 QueryClient は
        Suspense の外側で保持します。このページを離れるとキャッシュは破棄されます。
      </p>
      <ul className="my-3 list-disc space-y-2 pl-6">
        <li>初回：キャッシュがないため、結果欄の fallback を表示します。</li>
        <li>通常のキー変更：未取得の次の項目に切り替え、結果欄を fallback に置き換えます。</li>
        <li>
          Transition のキー変更：未取得の次の項目を待つ間、前の結果を保持します。初回の fallback
          を消す機能ではありません。
        </li>
        <li>
          同じキーの再取得：キャッシュがあるので Suspend せず、isFetching
          で待機を表示します。Transition は使いません。
        </li>
      </ul>
      <p className="my-3">
        自動再取得を避けるため staleTime は
        Infinity。再取得ボタンで明示的に更新し、完了時刻の変化を確認してください。
      </p>
      <QueryClientProvider client={client}>
        {!started ? (
          <button
            className="rounded bg-blue-700 px-4 py-2 text-white"
            onClick={() => setStarted(true)}
          >
            開始（ブラウザーで取得）
          </button>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                disabled={isPending}
                onClick={() => setItem((previous) => previous + 1)}
              >
                通常のキー変更（2秒）
              </button>
              <button
                className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-50"
                disabled={isPending}
                onClick={() => startTransition(() => setItem((previous) => previous + 1))}
              >
                Transition のキー変更（2秒）
              </button>
            </div>
            <p role="status" className="my-3">
              {isPending ? "Transition 待機中：前の結果を保持" : `選択中のキー：${item}`}
            </p>
            <Suspense
              fallback={
                <p
                  role="status"
                  data-testid="query-fallback"
                  className="my-3 rounded bg-amber-100 p-3"
                >
                  Query の結果欄を読み込み中（2秒）…
                </p>
              }
            >
              <QueryResult item={item} />
            </Suspense>
          </>
        )}
      </QueryClientProvider>
    </section>
  );
}
