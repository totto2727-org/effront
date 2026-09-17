import { effrontServer } from "@effront/server/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effrontTailwind(), effront(), effrontServer()],
});
