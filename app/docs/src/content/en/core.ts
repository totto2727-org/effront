import type { DocPage } from "../types.ts";
import { page as overview } from "./architecture/overview.tsx";
import { page as application } from "./architecture/application.tsx";
import { page as routing } from "./architecture/routing.tsx";
import { page as request } from "./architecture/request.tsx";
import { page as rendering } from "./architecture/rendering.tsx";
import { page as navigation } from "./architecture/navigation.tsx";
import { page as serverFunctions } from "./architecture/server-functions.tsx";

export const englishCorePages: readonly DocPage[] = [
  overview,
  application,
  routing,
  request,
  rendering,
  navigation,
  serverFunctions,
];
