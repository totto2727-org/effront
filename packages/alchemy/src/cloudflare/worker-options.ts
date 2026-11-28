export const workerBinding = "VITE_EFFRONT_WORKER";

export const validateWorkerName = (name: unknown): string => {
  if (typeof name !== "string" || !/^[a-z][a-z0-9_]*$/.test(name) || name === "default") {
    throw new TypeError(
      "Effront Worker names must be lowercase named exports (letters, digits and underscores).",
    );
  }
  return name;
};

/** Selects a named export from the Workers module for this native Alchemy Worker. */
export const effrontWorkerOptions = (name: string) => ({
  env: { [workerBinding]: validateWorkerName(name) },
  vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
});
