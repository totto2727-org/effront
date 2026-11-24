import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront.tsx";

const worker = { fetch: createFetchHandler(application) };

// oxlint-disable-next-line import/no-default-export -- Cloudflare Workers reads the module default handler.
export default worker;
