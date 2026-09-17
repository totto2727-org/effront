import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  // Task discovery must not resolve workspace dist exports before the first pack.
  plugins:
    lazyPlugins(async () => {
      const { effrontCloudflare } = await import(/* @vite-ignore */ "@effront/cloudflare");
      const { effrontTailwind } = await import(/* @vite-ignore */ "@effront/tailwind");
      const { effront } = await import(/* @vite-ignore */ "@effront/vite");
      return [effrontTailwind(), effront(), effrontCloudflare()];
    }) ?? [],
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
