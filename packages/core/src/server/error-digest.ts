import { Clock, Effect, MutableRef } from "effect";

const initialSequence = 0;
const sequence = MutableRef.make(initialSequence);
const digestRadix = 36;

export const nextErrorDigest = Effect.map(Clock.currentTimeMillis, (now) => {
  const next = MutableRef.incrementAndGet(sequence);
  return `${now.toString(digestRadix)}-${next.toString(digestRadix)}`;
});
