/** Shared server-only stack identity. */
export const stack = {
  name: "effront-docs",
  stage: process.env["ALCHEMY_STAGE"] ?? "local",
};
