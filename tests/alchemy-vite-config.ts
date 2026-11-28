/** Converts a Worker's public Vite environment bindings the same way as Alchemy CLI. */
export const alchemyViteDefines = (env: Readonly<Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );
