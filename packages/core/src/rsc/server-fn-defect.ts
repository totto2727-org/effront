import { Schema } from "effect";

import { ServerFnErrorDetailSchema } from "./server-fn-error-detail.ts";

// oxlint-disable-next-line unicorn/throw-new-error -- Effect's schema error builder supplies the error superclass.
export class ServerFnDefect extends Schema.TaggedError<ServerFnDefect>()("ServerFnDefect", {
  detail: Schema.NullOr(ServerFnErrorDetailSchema),
  digest: Schema.String,
}) {}
