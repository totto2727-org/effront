import type * as ReactBrowser from "@vitejs/plugin-rsc/browser";
import type { CallServerCallback } from "@vitejs/plugin-rsc/browser";
import { Array, Option } from "effect";
import { vi } from "vitest";

const reactClient = vi.hoisted(() => {
  const serverFunctions: CallServerCallback[] = [];
  const transitionTypes: string[] = [];
  return { serverFunctions, transitionTypes };
});

vi.mock(import("react"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    addTransitionType: (type: string) => {
      reactClient.transitionTypes.push(type);
    },
  };
});

vi.mock("@vitejs/plugin-rsc/browser", () => ({
  createTemporaryReferenceSet: vi.fn<(typeof ReactBrowser)["createTemporaryReferenceSet"]>(
    () => ({}),
  ),
  // oxlint-disable-next-line typescript/promise-function-async -- Mirror the explicit promise returned by the fixture when argument encoding finishes.
  encodeReply: vi.fn<(typeof ReactBrowser)["encodeReply"]>(() =>
    Promise.resolve("encoded arguments"),
  ),
  setServerCallback: vi.fn<(typeof ReactBrowser)["setServerCallback"]>((invoke) => {
    reactClient.serverFunctions.push(invoke);
  }),
}));

export const resetReactClient = (): void => {
  reactClient.serverFunctions.length = 0;
  reactClient.transitionTypes.length = 0;
};

export const transitionTypes = (): string[] => reactClient.transitionTypes;

// oxlint-disable-next-line typescript/promise-function-async -- Tests observe the original callback result, including its rejection and transition timing.
export const invokeServerFn = (id: string, args: unknown[] = []): Promise<unknown> => {
  const invoke = Option.getOrThrow(Array.last(reactClient.serverFunctions));
  return invoke(id, args);
};
