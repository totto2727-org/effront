import { fileURLToPath } from "node:url";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL("./fixture", import.meta.url)),
  // Task discovery must not resolve workspace dist exports before the first pack.
  plugins:
    lazyPlugins(async () => {
      const { effrontCloudflare } = await import(/* @vite-ignore */ "@effront/cloudflare");
      const { effront } = await import(/* @vite-ignore */ "@effront/vite");
      return [effront(), effrontCloudflare({ inspectorPort: false, persistState: false })];
    }) ?? [],
});
