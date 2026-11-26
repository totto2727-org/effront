import type { createFromReadableStream } from "@vitejs/plugin-rsc/browser";
import type { TransitionFunction } from "react";
import { vi } from "vitest";

vi.mock("@vitejs/plugin-rsc/browser", () => ({
  createFromReadableStream: vi.fn<typeof createFromReadableStream>(),
}));

const recorded = vi.hoisted(() => {
  const transitionResults: unknown[] = [];
  const transitionTypes: string[] = [];
  return { transitionResults, transitionTypes };
});

vi.mock(import("react"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    addTransitionType: (type: string) => {
      recorded.transitionTypes.push(type);
    },
    startTransition: (action: TransitionFunction) => {
      original.startTransition((): ReturnType<TransitionFunction> => {
        const result = action();
        recorded.transitionResults.push(result);
        return result;
      });
    },
  };
});

export const readTransitions = (): Readonly<typeof recorded> => recorded;

export const resetTransitions = (): void => {
  recorded.transitionResults.length = 0;
  recorded.transitionTypes.length = 0;
};
