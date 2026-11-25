import { effrontServer } from "@effront/server/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export -- Vite reads its configuration through the default export.
export default defineConfig({
  plugins: [effrontTailwind(), effront(), effrontServer()],
});
