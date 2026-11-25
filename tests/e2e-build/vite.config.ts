import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { acceptanceAudits } from "./support/client-graph.ts";

// oxlint-disable-next-line import/no-default-export -- Vite reads its configuration through the default export.
export default defineConfig({
  plugins: [
    effront(),
    effrontCloudflare({ inspectorPort: false, persistState: false }),
    acceptanceAudits(),
  ],
  root: `${import.meta.dirname}/fixture`,
});
