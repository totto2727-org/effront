#!/usr/bin/env node
import { runCli } from "./cli.js";

runCli(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`create-effront: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
