import { expect, type APIRequestContext } from "@playwright/test";

/** Direct Flight probes use the same initial-document build token as the browser. */
export async function buildHeaders(request: APIRequestContext) {
  const response = await request.get("/en");
  expect(response.status()).toBe(200);
  const buildId = response.headers()["x-effront-build-id"];
  expect(buildId).toBeTruthy();
  if (!buildId) throw new Error("The built docs response must identify its deployment.");
  return { "x-effront-build-id": buildId };
}
