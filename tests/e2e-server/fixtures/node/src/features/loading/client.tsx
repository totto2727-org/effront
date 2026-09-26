"use client";

import { Suspense, use, useRef, useState, useTransition } from "react";

function Result({ result }: { readonly result: Promise<string> | null }) {
  const text = result === null ? "初期結果（待機なし）" : use(result);
  return <p className="my-3 rounded bg-emerald-100 p-3">{text}</p>;
}

export function SuspensionDemo({ local }: { readonly local: boolean }) {
  const [result, setResult] = useState<Promise<string> | null>(null);
  const [isPending, startTransition] = useTransition();
  const attempt = useRef(0);

  function load(transition: boolean) {
    attempt.current += 1;
    const current = attempt.current;
    // An event owns each promise. Creating it during render would suspend again on retry.
    const next = new Promise<string>((resolve) => {
      setTimeout(() => resolve(`更新 ${current} 完了（2秒）`), 2_000);
    });
    if (transition) startTransition(() => setResult(next));
    else setResult(next);
  }

  return (
    <section
      aria-label={local ? "ローカル境界" : "ルート境界"}
      className="my-5 rounded border border-slate-300 p-4"
    >
      <h3 className="text-lg font-bold">
        {local ? "明示的なローカル Suspense" : "ローカル境界なし"}
      </h3>
      <p className="my-3">
        {local
          ? "通常更新は結果欄だけを fallback に置き換えます。他のカードや操作ボタンは残ります。"
          : "通常更新は最寄りのルート Loading まで伝播し、このページ全体を一時的に隠します。外側のレイアウトは残ります。"}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={isPending}
          onClick={() => load(false)}
        >
          通常更新（2秒）
        </button>
        <button
          className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={isPending}
          onClick={() => load(true)}
        >
          Transition 更新（2秒）
        </button>
      </div>
      <p role="status" className="my-3">
        {isPending ? "Transition 待機中：前の結果を保持" : "操作できます"}
      </p>
      {local ? (
        <Suspense fallback={<p role="status">結果欄だけ読み込み中（2秒）…</p>}>
          <Result result={result} />
        </Suspense>
      ) : (
        <Result result={result} />
      )}
    </section>
  );
}
