#!/usr/bin/env node
import { CliError } from "effect/unstable/cli";
import { runCli } from "./cli.js";

runCli(process.argv.slice(2)).catch((error: unknown) => {
  if (!(error instanceof CliError.ShowHelp)) {
    console.error(`create-effront: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exitCode = 1;
});
