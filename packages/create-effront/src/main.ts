#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/cli";
// oxlint-disable-next-line import/no-relative-parent-imports -- Read the CLI version from its own published package metadata.
import packageJson from "../package.json" with { type: "json" };
import { command } from "./cli.ts";

command.pipe(
  Command.run({ version: packageJson.version }),
  Effect.provide(NodeServices.layer),
  // oxlint-disable-next-line rules/no-effect-runtime-run -- This CLI entrypoint owns the process and runs its command once.
  NodeRuntime.runMain(),
);
