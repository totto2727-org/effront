import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createProject, isPlatform, platforms, type Platform } from "./init.js";

export function parseArgs(args: string[]): {
  directory: string | undefined;
  platform: Platform | undefined;
  help?: boolean;
} {
  let directory: string | undefined;
  let platform: Platform | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { directory, platform, help: true };
    if (arg === "--platform") {
      const value = args[++index];
      if (!value || !isPlatform(value)) {
        throw new Error(`--platform must be one of: ${platforms.join(", ")}`);
      }
      platform = value;
    } else if (arg?.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (arg && !directory) {
      directory = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return { directory, platform };
}

export async function runCli(args: string[]): Promise<void> {
  const options = parseArgs(args);
  if (options.help) {
    stdout.write(
      `Usage: vp create effront -- [directory] --platform ${platforms.join("|")}\nPlatforms: node, bun, cloudflare (standalone Workers), alchemy-cloudflare (Alchemy-managed Workers)\n`,
    );
    return;
  }
  let { directory, platform } = options;
  if (!directory || !platform) {
    if (!stdin.isTTY || !stdout.isTTY) {
      throw new Error("Specify a directory and --platform in non-interactive mode.");
    }
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      directory ||=
        (await prompt.question("Project directory (my-effront-app): ")).trim() || "my-effront-app";
      if (!platform) {
        const answer = (await prompt.question(`Platform (${platforms.join("/")}): `)).trim();
        if (!isPlatform(answer))
          throw new Error(`Platform must be one of: ${platforms.join(", ")}`);
        platform = answer;
      }
    } finally {
      prompt.close();
    }
  }
  const target = await createProject(directory, platform);
  stdout.write(
    `Created ${platform} Effront project at ${target}\nNext: cd ${directory} && vp install && vp dev\n`,
  );
}
