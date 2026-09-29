import { mergeConfig } from "vite";
import base from "../vite.config.ts";

/** Dev server for automated playtests: no HMR and no file watching, so work
 * in progress elsewhere in the tree can't reload the page mid-test. */
export default mergeConfig(base, {
  server: { hmr: false, watch: { ignored: ["**/*"] } },
});
