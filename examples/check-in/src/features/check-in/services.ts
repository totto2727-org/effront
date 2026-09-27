import { Context } from "effect";
import type { makeCheckInStore } from "./data";

export class CheckInStore extends Context.Service<
  CheckInStore,
  ReturnType<typeof makeCheckInStore>
>()("examples/check-in/CheckInStore") {}
