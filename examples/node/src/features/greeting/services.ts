import { Context, Layer } from "effect";

export class Host extends Context.Service<
  Host,
  { readonly label: string; readonly greeting: string }
>()("examples/node/Host") {}

export const HostLive = Layer.succeed(Host)({ label: "Node", greeting: "Hello from Node!" });
