import { effrontCloudflare } from "@effront/cloudflare";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effrontTailwind(), effront(), effrontCloudflare()],
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
