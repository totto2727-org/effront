import { Schema } from "effect";

// oxlint-disable-next-line unicorn/throw-new-error -- Effect's schema error builder supplies the error superclass.
export class ServerFnInputError extends Schema.TaggedError<ServerFnInputError>()(
  "ServerFnInputError",
  { detail: Schema.Struct({ message: Schema.String, name: Schema.String }) },
) {}
