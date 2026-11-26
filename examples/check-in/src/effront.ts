import { Application } from "@effront/core";
import type { CheckInStore } from "./features/check-in/services.ts";

export const EFFRONT = Application.effront<CheckInStore>();
