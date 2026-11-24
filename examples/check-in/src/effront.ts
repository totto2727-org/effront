import { Application } from "@effront/core";
import { CheckInStore } from "./features/check-in/services.ts";

export const EFFRONT = Application.effront<CheckInStore>();
