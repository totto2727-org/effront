import { Console, Effect, Option } from "effect";
import { Argument, CliError, Command, Flag, Prompt } from "effect/cli";
// oxlint-disable-next-line rules/no-node-imports -- Prompt eligibility depends on the native stdin and stdout TTY flags.
import { stdin, stdout } from "node:process";
import { createProject, platforms } from "./init.ts";

export const command = Command.make(
  "create-effront",
  {
    directory: Argument.String("directory").pipe(Argument.optional),
    platform: Flag.Literals("platform", platforms).pipe(Flag.optional),
  },
  Effect.fnUntraced(function* ({ directory, platform }) {
    if ((Option.isNone(directory) || Option.isNone(platform)) && (!stdin.isTTY || !stdout.isTTY)) {
      yield* new CliError.UserError({
        cause: "Specify a directory and --platform in non-interactive mode.",
      });
    }

    const targetDirectory = Option.isSome(directory)
      ? directory.value
      : yield* Prompt.run(
          Prompt.String({ default: "my-effront-app", message: "Project directory" }),
        );
    const targetPlatform = Option.isSome(platform)
      ? platform.value
      : yield* Prompt.run(
          Prompt.Select({
            choices: platforms.map((value) => ({ title: value, value })),
            message: "Platform",
          }),
        );
    const target = yield* Effect.tryPromise({
      catch: (cause) => new CliError.UserError({ cause }),
      try: async () => createProject(targetDirectory, targetPlatform),
    });
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
