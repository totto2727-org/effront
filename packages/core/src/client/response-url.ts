import { Option } from "effect";
import { HttpClientRequest, type HttpClientResponse } from "effect/unstable/http";

/**
 * Resolves the final Fetch URL on the pinned Effect 4.0.0-rc.112 transport.
 * That release keeps the Web Response in `source` without exposing its URL.
 * Guard this implementation boundary rather than asserting a private shape.
 * The fallback matches Effect's later public URL accessor for synthetic responses.
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
