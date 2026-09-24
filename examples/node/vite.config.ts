import { effrontServer } from "@effront/server/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { host: "127.0.0.1", port: 1341, strictPort: true },
  plugins: [await effrontTailwind({ root: import.meta.dirname }), effront(), effrontServer()],
});
