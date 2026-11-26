import { Clock, Effect } from "effect";
import { Suspense } from "react";
import type { JSX } from "react";

import { EFFRONT } from "#loading/effront.ts";
import { utcTimeText } from "./utc-time.ts";

const fastSeconds = 1;
const slowSeconds = 3;
const waitingA1 = <output className="block">A1 を読み込み中（1秒）…</output>;
const waitingA2 = <output className="block">A2 を読み込み中（3秒）…</output>;
const waitingBoth = <output className="block">B1 と B2 をまとめて読み込み中（最大3秒）…</output>;
const waitingChild = <output className="block">子を読み込み中（ここから1.5秒）…</output>;
const waitingParent = <output className="block">親を読み込み中（1.5秒）…</output>;

const renderTiming = ({
  startedAt,
  completedAt,
}: Readonly<{
  startedAt: number;
  completedAt: number;
}>): JSX.Element => (
  <p className="mb-3 text-sm text-slate-600">
    サーバー UTC：開始 {utcTimeText(startedAt)} → 完了 {utcTimeText(completedAt)}
    （実測 {completedAt - startedAt} ms）
  </p>
);

const DelayedResult = EFFRONT.Component.make({
  render: Effect.fn("DelayedResult.render")(function* ({
    label,
    seconds,
  }: Readonly<{
    label: string;
    seconds: number;
  }>) {
    const startedAt = yield* Clock.currentTimeMillis;
    yield* Effect.sleep(`${seconds} seconds`);
    const completedAt = yield* Clock.currentTimeMillis;
    return (
      <>
        <p
          data-started-at={startedAt}
          data-completed-at={completedAt}
          className="my-2 rounded bg-emerald-100 p-3"
        >
          {label} 完了（{seconds}秒）
        </p>
        {renderTiming({ completedAt, startedAt })}
      </>
    );
  }),
});

const DependentChild = EFFRONT.Component.make({
  render: Effect.fn("DependentChild.render")(function* ({
    parentResult,
  }: Readonly<{
    parentResult: string;
  }>) {
    const startedAt = yield* Clock.currentTimeMillis;
    yield* Effect.sleep("1.5 seconds");
    const completedAt = yield* Clock.currentTimeMillis;
    return (
      <>
        <p
          data-started-at={startedAt}
          data-completed-at={completedAt}
          className="my-2 rounded bg-emerald-100 p-3"
        >
          子 完了（{parentResult}を使用 + 1.5秒）
        </p>
        {renderTiming({ completedAt, startedAt })}
      </>
    );
  }),
});

const DependentParent = EFFRONT.Component.make({
  render: Effect.fn("DependentParent.render")(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    yield* Effect.sleep("1.5 seconds");
    const completedAt = yield* Clock.currentTimeMillis;
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
        {renderTiming({ completedAt, startedAt })}
        <Suspense fallback={waitingChild}>
          <DependentChild parentResult={parentResult} />
        </Suspense>
      </>
    );
  }),
});

const renderPendingA1 = (): JSX.Element => (
  <Suspense fallback={waitingA1}>
    <DelayedResult label="A1" seconds={fastSeconds} />
  </Suspense>
);

const renderPendingA2 = (): JSX.Element => (
  <Suspense fallback={waitingA2}>
    <DelayedResult label="A2" seconds={slowSeconds} />
  </Suspense>
);

const renderPendingBoth = (): JSX.Element => (
  <Suspense fallback={waitingBoth}>
    <DelayedResult label="B1" seconds={fastSeconds} />
    <DelayedResult label="B2" seconds={slowSeconds} />
  </Suspense>
);

const renderPendingParent = (): JSX.Element => (
  <Suspense fallback={waitingParent}>
    <DependentParent />
  </Suspense>
);

const renderParallelStages = (): JSX.Element => (
  <section aria-label="並列・別々の境界" className="my-4 rounded border border-slate-300 p-4">
    <h3 className="text-lg font-bold">A. 並列の兄弟 / 別々の境界</h3>
    <p className="my-3">A1 と A2 は独立。約1秒で A1、約3秒で A2 が見えます。</p>
    {renderPendingA1()}
    {renderPendingA2()}
  </section>
);

const renderSharedStages = (): JSX.Element => (
  <section aria-label="並列・共通の境界" className="my-4 rounded border border-slate-300 p-4">
    <h3 className="text-lg font-bold">B. 並列の兄弟 / 共通の境界</h3>
    <p className="my-3">
      B1 は1秒で準備完了しても隠れたまま。約3秒で B1 と B2 が一緒に見えます（1 +
      3秒ではありません）。
    </p>
    {renderPendingBoth()}
  </section>
);

const renderDependentStages = (): JSX.Element => (
  <section aria-label="直列・入れ子の境界" className="my-4 rounded border border-slate-300 p-4">
    <h3 className="text-lg font-bold">C. 依存する親子 / 入れ子の境界</h3>
    <p className="my-3">
      親が1.5秒待ってから結果を子に渡します。そこで子の1.5秒が始まり、合計約3秒。単なる JSX
      の入れ子ではなく、親の await 後に子を作る依存関係です。
    </p>
    {renderPendingParent()}
  </section>
);

export const Stages = EFFRONT.Page.make({
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
        {renderParallelStages()}
        {renderSharedStages()}
        {renderDependentStages()}
      </section>,
    ),
});
