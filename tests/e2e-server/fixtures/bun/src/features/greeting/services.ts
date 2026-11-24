import { Context, Layer } from "effect";

export class Host extends Context.Service<Host, Readonly<{ label: string; greeting: string }>>()(
  "tests/e2e-server/fixtures/bun/Host",
) {}

export const HostLive = Layer.succeed(Host)({ label: "Bun", greeting: "Hello from Bun!" });
