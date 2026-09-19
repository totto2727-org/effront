import type { DocPage } from "../types";
import { page as overview } from "./architecture/overview";
import { page as application } from "./architecture/application";
import { page as routing } from "./architecture/routing";
import { page as request } from "./architecture/request";
import { page as rendering } from "./architecture/rendering";
import { page as navigation } from "./architecture/navigation";
import { page as serverFunctions } from "./architecture/server-functions";

export const englishCorePages: readonly DocPage[] = [
  overview,
  application,
  routing,
  request,
  rendering,
  navigation,
  serverFunctions,
];
