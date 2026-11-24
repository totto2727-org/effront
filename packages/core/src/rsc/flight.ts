import type { ReactFormState } from "react-dom/client";

import type { RouteTreeModel } from "./route-tree.ts";
import type { ServerFnFailureModel } from "./server-fn-error.ts";

export type FlightPayload = Readonly<{
  formState: ReactFormState | null;
  routeTree: RouteTreeModel;
  serverFnResult: ServerFnResult | null;
}>;

export type ServerFnResult =
  | Readonly<{ _tag: "Success"; value: unknown }>
  | Readonly<{ _tag: "Failure"; error: ServerFnFailureModel }>;

export const FlightMediaType = "text/x-component";
export const ServerFnIdHeader = "x-effront-server-fn";
export const ServerFnQueryPath = "/_effront/query";
