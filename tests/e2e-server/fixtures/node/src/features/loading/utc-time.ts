import { DateTime } from "effect";

const startOfClock = 11;
const endOfMilliseconds = 23;

export const utcTimeText = (millis: number): string => {
  const iso = DateTime.formatIso(DateTime.makeUnsafe(millis));
  return iso.slice(startOfClock, endOfMilliseconds);
};
