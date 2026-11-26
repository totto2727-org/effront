import { toHttpEffect } from "@effront/core/http";
import { Predicate } from "effect";
import application from "./entry.effront.tsx";

export const handler = toHttpEffect(application);
if (Predicate.isNotNullish(import.meta.hot)) {
  import.meta.hot.accept();
}
