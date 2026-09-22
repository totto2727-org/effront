import { effrontServer } from "@effront/server/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { host: "127.0.0.1", port: 1342, strictPort: true },
  preview: { host: "127.0.0.1", port: 4342, strictPort: true },
  plugins: [effrontTailwind(), effront(), effrontServer()],
});
