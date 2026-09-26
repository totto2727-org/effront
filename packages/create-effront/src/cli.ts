import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseArgs as parseNodeArgs } from "node:util";
import { createProject, isPlatform, platforms, type Platform } from "./init.js";

export function parseArgs(args: string[]): {
  directory: string | undefined;
  platform: Platform | undefined;
  help?: boolean;
} {
  const { positionals, values } = parseNodeArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      platform: { type: "string" },
    },
  });
  if (positionals.length > 1) {
    throw new Error(`Unexpected argument: ${positionals[1]}`);
  }
  if (values.help) {
    return { directory: positionals[0], platform: undefined, help: true };
  }
  if (values.platform !== undefined && !isPlatform(values.platform)) {
    throw new Error(`--platform must be one of: ${platforms.join(", ")}`);
  }
  return { directory: positionals[0], platform: values.platform as Platform | undefined };
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
    `Created ${platform} Effront project at ${target}\nNext: cd ${directory} && vp install && ${platform === "alchemy-cloudflare" ? "vp run dev" : "vp dev"}\n`,
  );
}
