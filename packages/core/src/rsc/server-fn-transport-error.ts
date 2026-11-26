import { Schema } from "effect";

import { ServerFnErrorDetailSchema } from "./server-fn-error-detail.ts";

// oxlint-disable-next-line unicorn/throw-new-error -- Effect's schema error builder supplies the error superclass.
export class ServerFnTransportError extends Schema.TaggedError<ServerFnTransportError>()(
  "ServerFnTransportError",
  { detail: ServerFnErrorDetailSchema },
) {}
