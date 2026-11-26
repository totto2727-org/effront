// oxlint-disable-next-line import/no-unassigned-import -- Enable the Schema JIT before starting the browser application.
import "effect/schema/SchemaJITCompiler/enable";
import { BrowserRuntime } from "@effect/platform-browser";

import { browserMain } from "./application.ts";

// oxlint-disable-next-line rules/no-effect-runtime-run -- This browser bundle module is the client application entrypoint.
BrowserRuntime.runMain(browserMain);
