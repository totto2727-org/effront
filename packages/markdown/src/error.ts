import { Data } from "effect";

/** Collection configuration or unresolved file references. */
export class MarkdownError extends Data.TaggedError("MarkdownError")<
  Readonly<{
    message: string;
  }>
> {}

/** A Comark parser or plugin failure, with the original thrown value. */
export class MarkdownParseError extends Data.TaggedError("MarkdownParseError")<
  Readonly<{
    message: string;
    cause: unknown;
  }>
> {}
