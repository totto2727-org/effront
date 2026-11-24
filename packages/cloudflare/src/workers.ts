import { createWorkersContextAccessors as createAccessors } from "@effront/core/workers";
import type { WorkersRequestContext } from "@effront/core/workers";
import type { Effect } from "effect";

/** Minimal Cloudflare execution context supported by these accessors. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- Preserve the public type alias's assignability to indexable host contexts.
export type CloudflareExecutionContext = {
  // oxlint-disable-next-line typescript/method-signature-style -- Preserve the native waitUntil method's variance for existing consumers.
  waitUntil(promise: Promise<unknown>): void;
};

/**
 * Creates typed readers of the core request context.
 * @returns {ReturnType<typeof createAccessors<Env, CloudflareExecutionContext>>} Readers with Cloudflare's fixed execution context type.
 */
export const createWorkersContextAccessors = <Env = unknown>(): ReturnType<
  typeof createAccessors<Env, CloudflareExecutionContext>
> => createAccessors<Env, CloudflareExecutionContext>();

export const getWorkersEnv = <Env = unknown>(): Effect.Effect<Env> =>
  createWorkersContextAccessors<Env>().getWorkersEnv();

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Consumers select their host binding type explicitly.
export const getWorkersRequestContext = <Env = unknown>(): Effect.Effect<
  WorkersRequestContext<Env, CloudflareExecutionContext>
> => createWorkersContextAccessors<Env>().getWorkersRequestContext();
