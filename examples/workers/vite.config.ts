import { effrontCloudflare } from "@effront/cloudflare";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { host: "127.0.0.1", port: 1343, strictPort: true },
  plugins: [await effrontTailwind({ root: import.meta.dirname }), effront(), effrontCloudflare()],
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
