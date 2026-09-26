#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import packageJson from "../package.json" with { type: "json" };
import { command } from "./cli.js";

command.pipe(
  Command.run({ version: packageJson.version }),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain(),
);
