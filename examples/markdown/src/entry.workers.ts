import { createFetchHandler } from "@effront/core/workers";
import application from "./application";

export default { fetch: createFetchHandler(application) };
