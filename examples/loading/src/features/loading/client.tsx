"use client";

import { Suspense, useCallback, useRef, useState, useTransition } from "react";
import type { JSX } from "react";

import { SuspensionControls } from "./suspension-controls.tsx";
import { SuspensionResult } from "./suspension-result.tsx";

const initialAttempt = 0;
const attemptIncrement = 1;
const interactionDelay = 2000;
const pendingResult = <output className="block">結果欄だけ読み込み中（2秒）…</output>;

const createResult = async (attempt: number): Promise<string> => {
  const { promise, resolve } = Promise.withResolvers<string>();
  globalThis.setTimeout(() => {
    resolve(`更新 ${attempt} 完了（2秒）`);
  }, interactionDelay);
  return promise;
};

const renderDescription = (local: boolean): JSX.Element => (
  <>
    <h3 className="text-lg font-bold">
      {local ? "明示的なローカル Suspense" : "ローカル境界なし"}
    </h3>
    <p className="my-3">
      {local
        ? "通常更新は結果欄だけを fallback に置き換えます。他のカードや操作ボタンは残ります。"
        : "通常更新は最寄りのルート Loading まで伝播し、このページ全体を一時的に隠します。外側のレイアウトは残ります。"}
    </p>
  </>
);

const renderResult = (local: boolean, result: Promise<string> | undefined): JSX.Element => {
  const view = <SuspensionResult result={result} />;
  return local ? <Suspense fallback={pendingResult}>{view}</Suspense> : view;
};

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SuspensionDemo({ local }: Readonly<{ local: boolean }>): JSX.Element {
  const [result, setResult] = useState<Promise<string>>();
  const [isPending, startTransition] = useTransition();
  const attempt = useRef(initialAttempt);
  const load = useCallback(
    (transition: boolean) => {
      attempt.current += attemptIncrement;
      // A single browser event creates the promise that React can read again on retry.
      const next = createResult(attempt.current);
      if (transition) {
        startTransition(() => {
          setResult(next);
        });
      } else {
        setResult(next);
      }
    },
    [startTransition],
  );
  const update = useCallback(() => {
    load(false);
  }, [load]);
  const updateWithTransition = useCallback(() => {
    load(true);
  }, [load]);

  return (
    <section
      aria-label={local ? "ローカル境界" : "ルート境界"}
      className="my-5 rounded border border-slate-300 p-4"
    >
      {renderDescription(local)}
      <SuspensionControls
        isPending={isPending}
        update={update}
        updateWithTransition={updateWithTransition}
      />
      <output className="my-3 block">
        {isPending ? "Transition 待機中：前の結果を保持" : "操作できます"}
      </output>
      {renderResult(local, result)}
    </section>
  );
}
