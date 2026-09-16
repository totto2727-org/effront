/** Shared server-only identity for the Alchemy stack and its native runtime bridge. */
export const stack = {
  name: "effront-markdown-example",
  stage: process.env["ALCHEMY_STAGE"] ?? "local",
};
