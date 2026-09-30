import { Clock, Effect } from "effect";

let sequence = 0;

export const nextErrorDigest = Effect.map(Clock.currentTimeMillis, (now) => {
  sequence += 1;
  return `${now.toString(36)}-${sequence.toString(36)}`;
});
