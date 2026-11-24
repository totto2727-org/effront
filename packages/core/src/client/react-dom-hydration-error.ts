import { Schema } from "effect";

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is the Effect error class factory, not an error instance.
export class ReactDOMHydrationError extends Schema.TaggedError<ReactDOMHydrationError>()(
  "ReactDOMHydrationError",
  { cause: Schema.Defect() },
) {}
