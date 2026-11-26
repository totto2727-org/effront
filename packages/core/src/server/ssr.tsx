// oxlint-disable-next-line import/no-unassigned-import -- The SSR graph enables Effect Schema's JIT decoder during startup.
import "effect/schema/SchemaJITCompiler/enable";
import { createFromReadableStream, getClientEntryUrl } from "@vitejs/plugin-rsc/ssr";
import { Function } from "effect";
import { use } from "react";
import type { JSX } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

import { RouteTree } from "#core/client/route-tree.tsx";
import type { FlightPayload } from "#core/rsc/flight.ts";
import { injectFlightPayload } from "./flight-html-stream.ts";
import type { HtmlRenderOptions } from "./html-renderer.tsx";

export const renderHtml = async (
  stream: ReadableStream<Uint8Array>,
  options: HtmlRenderOptions,
): Promise<ReadableStream<Uint8Array>> => {
  const [ssrFlightStream, browserFlightStream] = stream.tee();
  const decodePayload = Function.memoize(
    // oxlint-disable-next-line typescript/promise-function-async -- React reads the original RSC thenable and its metadata when it suspends.
    (flight: ReadableStream<Uint8Array>) => createFromReadableStream<FlightPayload>(flight),
  );

  const SsrRoot = (): JSX.Element => {
    const { routeTree } = use(decodePayload(ssrFlightStream));
    return <RouteTree root={routeTree} />;
  };

  const html = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: `import(${JSON.stringify(getClientEntryUrl())})`,
    formState: options.formState,
    signal: options.signal,
  });
  return html.pipeThrough(injectFlightPayload(browserFlightStream));
};
