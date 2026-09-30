import type { ReactFormState } from "react-dom/client";

import type { RouteTreeModel } from "./route-tree";
import type { ServerFnFailureModel } from "./server-fn-error";

export type FlightPayload = {
  readonly formState: ReactFormState | null;
  readonly routeTree: RouteTreeModel;
  readonly serverFnResult: ServerFnResult | null;
};

export type ServerFnResult =
  | { readonly _tag: "Success"; readonly value: unknown }
  | { readonly _tag: "Failure"; readonly error: ServerFnFailureModel };

export const FlightMediaType = "text/x-component";
export const ServerFnIdHeader = "x-effront-server-fn";
export const ServerFnQueryPath = "/_effront/query";
