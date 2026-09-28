import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/** Build id shown in the corner of the game: commit count + short sha. */
function buildId(): string {
  try {
    const count = execSync("git rev-list --count HEAD").toString().trim();
    const sha = execSync("git rev-parse --short HEAD").toString().trim();
    return `b${count} · ${sha}`;
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: {
    port: 3000,
    proxy: { "/ws": { target: "ws://localhost:8787", ws: true } },
  },
  worker: { format: "es" },
  build: { target: "es2022", sourcemap: true },
});
