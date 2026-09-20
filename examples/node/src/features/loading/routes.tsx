import { Effect } from "effect";
import { Suspense } from "react";
import { EFFRONT } from "../../effront";
import { Counter } from "../../components/counter";
import { SuspensionDemo } from "./client";
import { QueryDemo } from "./query-client";

function Timing({
  startedAt,
  completedAt,
}: {
  readonly startedAt: number;
  readonly completedAt: number;
}) {
  return (
    <p className="mb-3 text-sm text-slate-600">
      サーバー UTC：開始 {new Date(startedAt).toISOString().slice(11, 23)} → 完了{" "}
      {new Date(completedAt).toISOString().slice(11, 23)}
      （実測 {completedAt - startedAt} ms）
    </p>
  );
}

const Loading = EFFRONT.Loading.make({
  render: () => (
    <p role="status" data-testid="route-loading" className="my-5 rounded bg-amber-100 p-4">
      ルート Loading：ページを読み込み中（2秒）…
    </p>
  ),
});

const Layout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <div lang="ja">
        <header className="my-5 rounded bg-blue-100 p-4" data-testid="loading-layout">
          <h1 className="text-2xl font-bold">Loading / Suspense 実験室</h1>
          <p className="my-3">
            このレイアウトはルート Loading の外側です。Navigation API
            対応環境では、カウンターを増やしてから移動すると状態が残ります。未対応環境では通常のページ移動になります。
          </p>
          <Counter />
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
        </header>
        {children}
      </div>,
    ),
});

const Home = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <section className="space-y-4">
        <h2 className="text-xl font-bold">同じ「待つ」でも境界で見え方が変わる</h2>
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            リンクは onClick のない通常の &lt;a href&gt;。移動先の Effect.sleep が2秒待ち、ルート
            Loading が表示されます。
          </li>
          <li>
            独立した兄弟の待機と、親の結果に依存する子の待機を比較します。待機の順序と Suspense
            の表示単位は別の概念です。
          </li>
          <li>
            クライアントで新しい Promise を読み、最寄りの境界と Transition の違いを確認します。
          </li>
          <li>
            子が useSuspenseQuery で取得します。Promise props
            なしで、初回・キー変更・再取得を比較します。
          </li>
        </ol>
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

const DelayedResult = EFFRONT.Component.make({
  render: Effect.fn("DelayedResult.render")(function* ({
    label,
    seconds,
  }: {
    readonly label: string;
    readonly seconds: number;
  }) {
    const startedAt = yield* Effect.sync(Date.now);
    yield* Effect.sleep(`${seconds} seconds`);
    const completedAt = yield* Effect.sync(Date.now);
    return (
      <>
        <p
          data-started-at={startedAt}
          data-completed-at={completedAt}
          className="my-2 rounded bg-emerald-100 p-3"
        >
          {label} 完了（{seconds}秒）
        </p>
        <Timing startedAt={startedAt} completedAt={completedAt} />
      </>
    );
  }),
});

const DependentChild = EFFRONT.Component.make({
  render: Effect.fn("DependentChild.render")(function* ({
    parentResult,
  }: {
    readonly parentResult: string;
  }) {
    const startedAt = yield* Effect.sync(Date.now);
    yield* Effect.sleep("1.5 seconds");
    const completedAt = yield* Effect.sync(Date.now);
    return (
      <>
        <p
          data-started-at={startedAt}
          data-completed-at={completedAt}
          className="my-2 rounded bg-emerald-100 p-3"
        >
          子 完了（{parentResult}を使用 + 1.5秒）
        </p>
        <Timing startedAt={startedAt} completedAt={completedAt} />
      </>
    );
  }),
});

const DependentParent = EFFRONT.Component.make({
  render: Effect.fn("DependentParent.render")(function* () {
    const startedAt = yield* Effect.sync(Date.now);
    yield* Effect.sleep("1.5 seconds");
    const completedAt = yield* Effect.sync(Date.now);
    // The child cannot start until this parent has obtained its input.
    const parentResult = "親の結果";
    return (
      <>
        <p
          data-started-at={startedAt}
          data-completed-at={completedAt}
          className="my-2 rounded bg-emerald-100 p-3"
        >
          親 完了（1.5秒）
        </p>
        <Timing startedAt={startedAt} completedAt={completedAt} />
        <Suspense fallback={<p role="status">子を読み込み中（ここから1.5秒）…</p>}>
          <DependentChild parentResult={parentResult} />
        </Suspense>
      </>
    );
  }),
});

const Stages = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <section>
        <h2 className="text-xl font-bold">待機の順序 × 表示する境界</h2>
        <p className="my-3">
          3つのカードは同じリクエストで始まります。Suspense
          は待機を直列化するものではなく、どこまでまとめて表示するかを決めます。
        </p>
        <p className="my-3">
          完了後の UTC 時刻はサーバーの待機区間です（ブラウザーの表示時刻ではありません）。A/B
          の兄弟は区間が重なり、C の子は親の完了後に始まります。
        </p>
        <section aria-label="並列・別々の境界" className="my-4 rounded border border-slate-300 p-4">
          <h3 className="text-lg font-bold">A. 並列の兄弟 / 別々の境界</h3>
          <p className="my-3">A1 と A2 は独立。約1秒で A1、約3秒で A2 が見えます。</p>
          <Suspense fallback={<p role="status">A1 を読み込み中（1秒）…</p>}>
            <DelayedResult label="A1" seconds={1} />
          </Suspense>
          <Suspense fallback={<p role="status">A2 を読み込み中（3秒）…</p>}>
            <DelayedResult label="A2" seconds={3} />
          </Suspense>
        </section>
        <section aria-label="並列・共通の境界" className="my-4 rounded border border-slate-300 p-4">
          <h3 className="text-lg font-bold">B. 並列の兄弟 / 共通の境界</h3>
          <p className="my-3">
            B1 は1秒で準備完了しても隠れたまま。約3秒で B1 と B2 が一緒に見えます（1 +
            3秒ではありません）。
          </p>
          <Suspense fallback={<p role="status">B1 と B2 をまとめて読み込み中（最大3秒）…</p>}>
            <DelayedResult label="B1" seconds={1} />
            <DelayedResult label="B2" seconds={3} />
          </Suspense>
        </section>
        <section
          aria-label="直列・入れ子の境界"
          className="my-4 rounded border border-slate-300 p-4"
        >
          <h3 className="text-lg font-bold">C. 依存する親子 / 入れ子の境界</h3>
          <p className="my-3">
            親が1.5秒待ってから結果を子に渡します。そこで子の1.5秒が始まり、合計約3秒。単なる JSX
            の入れ子ではなく、親の await 後に子を作る依存関係です。
          </p>
          <Suspense fallback={<p role="status">親を読み込み中（1.5秒）…</p>}>
            <DependentParent />
          </Suspense>
        </section>
      </section>,
    ),
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
