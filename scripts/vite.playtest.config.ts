import { mergeConfig } from "vite";
import base from "../vite.config";

/** Dev server for automated playtests: no HMR, no file watching, so work
 * in progress elsewhere in the tree can't reload the page mid-test. */
export default mergeConfig(base, {
  server: { hmr: { overlay: false }, watch: null },
});
