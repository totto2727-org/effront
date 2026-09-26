import { Console, Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/unstable/cli";
import { stdin, stdout } from "node:process";
import { createProject, platforms } from "./init.js";

export const command = Command.make(
  "create-effront",
  {
    directory: Argument.string("directory").pipe(Argument.optional),
    platform: Flag.choice("platform", platforms).pipe(Flag.optional),
  },
  Effect.fn(function* ({ directory, platform }) {
    if ((Option.isNone(directory) || Option.isNone(platform)) && (!stdin.isTTY || !stdout.isTTY)) {
      return yield* Effect.fail(
        new Error("Specify a directory and --platform in non-interactive mode."),
      );
    }

    const targetDirectory = Option.isSome(directory)
      ? directory.value
      : yield* Prompt.run(Prompt.text({ message: "Project directory", default: "my-effront-app" }));
    const targetPlatform = Option.isSome(platform)
      ? platform.value
      : yield* Prompt.run(
          Prompt.select({
            message: "Platform",
            choices: platforms.map((value) => ({ title: value, value })),
          }),
        );
    const target = yield* Effect.tryPromise(() => createProject(targetDirectory, targetPlatform));
    yield* Console.log(
      `Created ${targetPlatform} Effront project at ${target}\nNext: cd ${targetDirectory} && vp install && ${targetPlatform === "alchemy-cloudflare" ? "vp run dev" : "vp dev"}`,
    );
  }),
).pipe(
  Command.withDescription("Create a minimal Effront application"),
  Command.withExamples([
    { command: "vp create effront -- my-app --platform node" },
    { command: "vp create effront -- my-app --platform alchemy-cloudflare" },
  ]),
);
