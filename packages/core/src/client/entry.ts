import "effect/schema/SchemaJITCompiler/enable";
import { BrowserRuntime } from "@effect/platform-browser";

import { browserMain } from "./application";

BrowserRuntime.runMain(browserMain);
