import { Predicate } from "effect";
import { use } from "react";
import type { JSX } from "react";

export const SuspensionResult = ({
  result,
}: Readonly<{ result: Promise<string> | undefined }>): JSX.Element => {
  const text = Predicate.isNullish(result) ? "初期結果（待機なし）" : use(result);
  return <p className="my-3 rounded bg-emerald-100 p-3">{text}</p>;
};
