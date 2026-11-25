import type { JSX } from "react";

type SuspensionControlsProps = Readonly<{
  isPending: boolean;
  update: () => void;
  updateWithTransition: () => void;
}>;

// oxlint-disable-next-line eslint/func-style -- React needs a named component for browser event props.
export function SuspensionControls({
  isPending,
  update,
  updateWithTransition,
}: SuspensionControlsProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={isPending}
        onClick={update}
      >
        通常更新（2秒）
      </button>
      <button
        type="button"
        className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={isPending}
        onClick={updateWithTransition}
      >
        Transition 更新（2秒）
      </button>
    </div>
  );
}
