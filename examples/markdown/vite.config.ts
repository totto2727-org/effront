import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  // Task discovery must not resolve workspace dist exports before the first pack.
  plugins:
    lazyPlugins(async () => {
      const { effrontAlchemy } = await import(
        /* @vite-ignore */ "@effront/alchemy/cloudflare/vite"
      );
      const { effrontTailwind } = await import(/* @vite-ignore */ "@effront/tailwind");
      const { effront } = await import(/* @vite-ignore */ "@effront/vite");
      return [effrontTailwind({ stylesheet: "./src/styles.css" }), effront(), effrontAlchemy()];
    }) ?? [],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
