import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

const worker = { fetch: createFetchHandler(application) };

// oxlint-disable-next-line import/no-default-export -- Wrangler uses the Worker’s default export.
export default worker;
