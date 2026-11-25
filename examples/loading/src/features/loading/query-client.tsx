"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useCallback, useState, useTransition } from "react";
import type { JSX } from "react";

import { QueryResult } from "./query-result.tsx";

const initialItem = 1;
const itemIncrement = 1;
const queryFallback = (
  <output data-testid="query-fallback" className="my-3 block rounded bg-amber-100 p-3">
    Query の結果欄を読み込み中（2秒）…
  </output>
);

const renderQuerySteps = (): JSX.Element => (
  <ul className="my-3 list-disc space-y-2 pl-6">
    <li>初回：キャッシュがないため、結果欄の fallback を表示します。</li>
    <li>通常のキー変更：未取得の次の項目に切り替え、結果欄を fallback に置き換えます。</li>
    <li>
      Transition のキー変更：未取得の次の項目を待つ間、前の結果を保持します。初回の fallback
      を消す機能ではありません。
    </li>
    <li>
      同じキーの再取得：キャッシュがあるので Suspend せず、isFetching で待機を表示します。Transition
      は使いません。
    </li>
  </ul>
);

const renderQueryIntroduction = (): JSX.Element => (
  <>
    <h2 className="text-xl font-bold">子が取得する useSuspenseQuery（各2秒）</h2>
    <p className="my-3">
      親は項目番号だけを渡し、子が queryKey と queryFn を持ちます。Promise props はありません。
      「use client」だけでは SSR を防げないため、「開始」を押すまで子を描画しません。
      取得はブラウザーだけで始まります。
    </p>
    <p className="my-3">
      同じホストの静的テキストを fetch
      します。観察用にブラウザーで2秒待ち、項目が変わっても本文は同じです。 QueryClient は Suspense
      の外側で保持します。このページを離れるとキャッシュは破棄されます。
    </p>
    {renderQuerySteps()}
    <p className="my-3">
      自動再取得を避けるため staleTime は
      Infinity。再取得ボタンで明示的に更新し、完了時刻の変化を確認してください。
    </p>
  </>
);

type QueryControls = Readonly<{
  advance: () => void;
  advanceTransition: () => void;
  pending: boolean;
}>;

const renderQueryControls = ({
  advance,
  advanceTransition,
  pending,
}: QueryControls): JSX.Element => (
  <div className="flex flex-wrap gap-3">
    <button
      type="button"
      className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
      disabled={pending}
      onClick={advance}
    >
      通常のキー変更（2秒）
    </button>
    <button
      type="button"
      className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-50"
      disabled={pending}
      onClick={advanceTransition}
    >
      Transition のキー変更（2秒）
    </button>
  </div>
);

const renderCurrentQuery = (item: number, controls: QueryControls): JSX.Element => (
  <>
    {renderQueryControls(controls)}
    <output className="my-3 block">
      {controls.pending ? "Transition 待機中：前の結果を保持" : `選択中のキー：${item}`}
    </output>
    <Suspense fallback={queryFallback}>
      <QueryResult item={item} />
    </Suspense>
  </>
);

const renderQueryStart = (start: () => void): JSX.Element => (
  <button type="button" className="rounded bg-blue-700 px-4 py-2 text-white" onClick={start}>
    開始（ブラウザーで取得）
  </button>
);

const createQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

const nextItem = (item: number): number => item + itemIncrement;

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function QueryDemo(): JSX.Element {
  // The client stays stable across retries because its owner is above the Suspense boundary.
  // oxlint-disable-next-line react/hook-use-state -- This state owns a QueryClient and never replaces it.
  const [client] = useState(createQueryClient);
  const [started, setStarted] = useState(false);
  const [item, setItem] = useState(initialItem);
  const [pending, startTransition] = useTransition();
  const start = useCallback(() => {
    setStarted(true);
  }, []);
  const advance = useCallback(() => {
    setItem(nextItem);
  }, []);
  const advanceTransition = useCallback(() => {
    startTransition(advance);
  }, [advance, startTransition]);

  return (
    <section aria-label="TanStack Query 実験">
      {renderQueryIntroduction()}
      <QueryClientProvider client={client}>
        {started
          ? renderCurrentQuery(item, { advance, advanceTransition, pending })
          : renderQueryStart(start)}
      </QueryClientProvider>
    </section>
  );
}
