import { Context } from "effect";

export class External extends Context.Service<External, Readonly<{ label: string }>>()(
  "effront/test/http/External",
) {}
