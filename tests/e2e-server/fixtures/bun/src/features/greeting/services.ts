import { Context, Layer } from "effect";

export class Host extends Context.Service<
  Host,
  { readonly label: string; readonly greeting: string }
>()("tests/e2e-server/fixtures/bun/Host") {}

export const HostLive = Layer.succeed(Host)({ label: "Bun", greeting: "Hello from Bun!" });
