import { createWorkersContextAccessors } from "@effront/cloudflare/workers";
import type { Env } from "./env.ts";

export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();
