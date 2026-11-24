import { Application } from "@effront/core";
import type { Host } from "./features/greeting/services.ts";

export const EFFRONT = Application.effront<Host>();
