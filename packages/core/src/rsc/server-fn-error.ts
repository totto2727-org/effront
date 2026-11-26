import { Schema } from "effect";

import { ServerFnDefect } from "./server-fn-defect.ts";
import { ServerFnInputError } from "./server-fn-input-error.ts";
import type { ServerFnTransportError } from "./server-fn-transport-error.ts";

export { ServerFnDefect } from "./server-fn-defect.ts";
export { serverFnErrorDetail } from "./server-fn-error-detail.ts";
export { ServerFnInputError } from "./server-fn-input-error.ts";
export { ServerFnTransportError } from "./server-fn-transport-error.ts";

export type ServerFnError = ServerFnInputError | ServerFnDefect | ServerFnTransportError;
export const ServerFnFailure = Schema.Union([ServerFnInputError, ServerFnDefect]);
export type ServerFnFailureModel = typeof ServerFnFailure.Encoded;
