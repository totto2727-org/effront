/** Shared server-only stack identity. */
export const stack = {
  name: "effront-workers-example",
  stage: process.env["ALCHEMY_STAGE"] ?? "local",
};
