import { Schema } from "effect";

// oxlint-disable-next-line unicorn/throw-new-error -- Effect's schema error builder supplies the error superclass.
export class HtmlRenderError extends Schema.TaggedError<HtmlRenderError>()("HtmlRenderError", {
  cause: Schema.Defect(),
}) {}
