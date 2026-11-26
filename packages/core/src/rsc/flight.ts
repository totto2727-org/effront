import type { Data } from "effect";
import type { ReactFormState } from "react-dom/client";

import type { RouteTreeModel } from "./route-tree.ts";
import type { ServerFnFailureModel } from "./server-fn-error.ts";

export type FlightPayload = Readonly<{
  formState: ReactFormState | null;
  routeTree: RouteTreeModel;
  serverFnResult: ServerFnResult | null;
}>;

export type ServerFnResult = Data.TaggedEnum<{
  Failure: { error: ServerFnFailureModel };
  Success: { value: unknown };
}>;

export const FlightMediaType = "text/x-component";
export const ServerFnIdHeader = "x-effront-server-fn";
export const ServerFnQueryPath = "/_effront/query";
