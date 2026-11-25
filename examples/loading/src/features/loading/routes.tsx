import { Effect } from "effect";
import type { JSX } from "react";
import { EFFRONT } from "#loading/effront.ts";
import { Counter } from "#loading/components/counter.tsx";
import { SuspensionDemo } from "./client.tsx";
import { QueryDemo } from "./query-client.tsx";
import { Stages } from "./stages.tsx";

const Loading = EFFRONT.Loading.make({
  render: () => (
    <output data-testid="route-loading" className="my-5 block rounded bg-amber-100 p-4">
      ルート Loading：ページを読み込み中（2秒）…
    </output>
  ),
});

const renderPlaygroundNavigation = (): JSX.Element => (
  <nav aria-label="実験メニュー" className="mt-4 flex flex-wrap gap-4">
    <a className="text-blue-700 underline" href="/loading">
      使い方
    </a>
    <a className="text-blue-700 underline" href="/loading/navigation">
      1. リンクで2秒待つ
    </a>
    <a className="text-blue-700 underline" href="/loading/stages">
      2. 段階的な表示
    </a>
    <a className="text-blue-700 underline" href="/loading/interaction">
      3. 操作で Suspend
    </a>
    <a className="text-blue-700 underline" href="/loading/query">
      4. Query で Suspend
    </a>
  </nav>
);

const renderPlaygroundHeader = (): JSX.Element => (
  <header className="my-5 rounded bg-blue-100 p-4" data-testid="loading-layout">
    <h1 className="text-2xl font-bold">Loading / Suspense 実験室</h1>
    <p className="my-3">
      このレイアウトはルート Loading の外側です。Navigation API
      対応環境では、カウンターを増やしてから移動すると状態が残ります。未対応環境では通常のページ移動になります。
    </p>
    <Counter />
    {renderPlaygroundNavigation()}
  </header>
);

const Layout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <div lang="ja">
        {renderPlaygroundHeader()}
        {children}
      </div>,
    ),
});

const renderInstructions = (): JSX.Element => (
  <ol className="list-decimal space-y-3 pl-6">
    <li>
      リンクは onClick のない通常の &lt;a href&gt;。移動先の Effect.sleep が2秒待ち、ルート Loading
      が表示されます。
    </li>
    <li>
      独立した兄弟の待機と、親の結果に依存する子の待機を比較します。待機の順序と Suspense
      の表示単位は別の概念です。
    </li>
    <li>クライアントで新しい Promise を読み、最寄りの境界と Transition の違いを確認します。</li>
    <li>
      子が useSuspenseQuery で取得します。Promise props なしで、初回・キー変更・再取得を比較します。
    </li>
  </ol>
);

const Home = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <section className="space-y-4">
        <h2 className="text-xl font-bold">同じ「待つ」でも境界で見え方が変わる</h2>
        {renderInstructions()}
        <p>
          秒数は意図的な待機時間です。通信・描画時間が加わるため、厳密な表示時刻ではありません。もう一度見るときは別の実験へ移動して戻ってください。
        </p>
      </section>,
    ),
});

const Navigation = EFFRONT.Page.make({
  render: Effect.fn("LoadingNavigation.render")(function* () {
    yield* Effect.sleep("2 seconds");
    return (
      <section>
        <h2 className="text-xl font-bold">リンク先のページが完成（2秒）</h2>
        <p className="my-4">
          リンク側にはイベントハンドラーも待機処理もありません。サーバーの Page
          が待ち、EFFRONT.Loading がその間の表示を担当します。
        </p>
        <p>上のカウンターとメニューはレイアウトにあるため、Loading に置き換わりません。</p>
      </section>
    );
  }),
});

const Interaction = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <section data-testid="interaction-page">
        <h2 className="text-xl font-bold">操作で Suspend（各2秒）</h2>
        <p className="my-3">
          ここではサーバー通信ではなく、クリックごとに作る Promise を React.use
          で読みます。通常更新と startTransition を比較してください。
        </p>
        <p className="my-3">
          Transition はすでに表示した結果を保持し、待機中の表示を出します。この例ではルート Loading
          もローカル fallback も表示しません。
        </p>
        <SuspensionDemo local={false} />
        <SuspensionDemo local />
      </section>,
    ),
});

const Query = EFFRONT.Page.make({ render: () => Effect.succeed(<QueryDemo />) });

export const loadingRoutes = EFFRONT.Routes.make({ layout: Layout, loading: Loading })
  .page("/", Home)
  .page("/navigation", Navigation)
  .page("/stages", Stages)
  .page("/interaction", Interaction)
  .page("/query", Query);
