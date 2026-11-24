import { Data } from "effect";

/** Collection configuration or unresolved file references. */
export class MarkdownError extends Data.TaggedError("MarkdownError")<
  Readonly<{
    message: string;
  }>
> {}

export { MarkdownParseError } from "./parse-error.ts";
