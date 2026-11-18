import { Data } from "effect";

/** Collection configuration or unresolved file references. */
export class MarkdownError extends Data.TaggedError("MarkdownError")<{
  readonly message: string;
}> {}

/** A Comark parser or plugin failure, with the original thrown value. */
export class MarkdownParseError extends Data.TaggedError("MarkdownParseError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}
