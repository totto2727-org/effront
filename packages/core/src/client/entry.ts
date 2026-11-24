import "effect/schema/SchemaJITCompiler/enable";
import * as BrowserRuntime from "@effect/platform-browser/BrowserRuntime";

import { browserMain } from "./application.ts";

BrowserRuntime.runMain(browserMain);
