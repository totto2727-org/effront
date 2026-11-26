import { Data } from "effect";

/** A Comark parser or plugin failure, with the original thrown value. */
export class MarkdownParseError extends Data.TaggedError("MarkdownParseError")<
  Readonly<{
    message: string;
    cause: unknown;
  }>
> {}
