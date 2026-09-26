import { Option } from "effect";
import { HttpClientRequest, type HttpClientResponse } from "effect/unstable/http";

/**
 * Resolves the final Fetch URL across Effect HTTP response implementations.
 * Prefer the public URL when available, then the underlying Web Response URL.
 * Guard the implementation boundary rather than asserting a private shape.
 * Synthetic responses fall back to the originating request URL.
 */
export const getResponseUrl = (response: HttpClientResponse.HttpClientResponse): string => {
  if ("url" in response && typeof response.url === "string") {
    return response.url.split("#", 1)[0] ?? "";
  }
  if ("source" in response && response.source instanceof Response && response.source.url !== "") {
    return response.source.url.split("#", 1)[0] ?? "";
  }
  const url = HttpClientRequest.toUrl(response.request);
  if (Option.isNone(url)) {
    return "";
  }
  url.value.hash = "";
  return url.value.href;
};
