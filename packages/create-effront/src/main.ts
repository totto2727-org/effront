#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { CliError, Command } from "effect/unstable/cli";
import packageJson from "../package.json" with { type: "json" };
import { command } from "./cli.js";

command.pipe(
  Command.run({ version: packageJson.version }),
  Effect.tapError((error) =>
    error instanceof CliError.ShowHelp
      ? Effect.void
      : Console.error(`create-effront: ${error instanceof Error ? error.message : String(error)}`),
  ),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain({ disableErrorReporting: true }),
);
