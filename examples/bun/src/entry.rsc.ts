import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront.tsx";

export const handler = toHttpEffect(application);
// oxlint-disable-next-line typescript/no-unnecessary-condition -- Vite's hot context is absent in the production server.
import.meta.hot?.accept();
