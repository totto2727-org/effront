import "effect/schema/SchemaJITCompiler/enable";
import { createFromReadableStream, getClientEntryUrl } from "@vitejs/plugin-rsc/ssr";
import { use } from "react";
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
  let payload: PromiseLike<FlightPayload> | null = null;

  function SsrRoot() {
    const { routeTree } = use(
      (payload ??= createFromReadableStream<FlightPayload>(ssrFlightStream)),
    );
    return <RouteTree root={routeTree} />;
  }

  const html = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: `import(${JSON.stringify(getClientEntryUrl())})`,
    formState: options.formState,
    signal: options.signal,
  });
  return html.pipeThrough(injectFlightPayload(browserFlightStream));
};
