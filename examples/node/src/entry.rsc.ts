import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront.tsx";

export const handler = toHttpEffect(application);
import.meta.hot?.accept();
