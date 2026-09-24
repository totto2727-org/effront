import { effrontServer } from "@effront/server/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { host: "127.0.0.1", port: 1342, strictPort: true },
  plugins: [effront(), effrontServer()],
});
