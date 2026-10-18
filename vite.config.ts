import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const getDate = (): string => {
  const date = new Date();
  const fmt = (n: number) => (n > 9 ? n : `0${n}`);
  return `${date.getFullYear()}-${fmt(date.getMonth() + 1)}-${fmt(date.getDate())}`;
};

const DEFAULT_SOURCE_URL = "https://github.com/MultiMote/niimblue";

const git = (...args: string[]): string | undefined => {
  try {
    const out = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out || undefined;
  } catch {
    return undefined; // not a git checkout, or git is not installed
  }
};

// Link to the repository and branch this build comes from (e.g. a fork or a feature branch).
// Falls back to the main repository if it can't be detected (no git, non-GitHub remote).
const getSourceUrl = (): string => {
  const match = git("remote", "get-url", "origin")?.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  if (!match) return DEFAULT_SOURCE_URL;

  const repoUrl = `https://github.com/${match[1]}`;
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (!branch || branch === "HEAD") return repoUrl; // detached HEAD: there is no branch to link to

  return `${repoUrl}/tree/${branch.split("/").map(encodeURIComponent).join("/")}`;
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.COMMIT_TAG),
    __APP_COMMIT__: JSON.stringify(process.env.COMMIT_HASH),
    __BUILD_DATE__: JSON.stringify(getDate()),
    __APP_SOURCE_URL__: JSON.stringify(getSourceUrl()),
  },
  optimizeDeps: {
    include: ["@mmote/niimbluelib"], // Fix browser error when using `npm link @mmote/niimbluelib`
  },
  resolve: {
    preserveSymlinks: true, // Fix build error when using `npm link @mmote/niimbluelib`
    alias: {
      $: resolve(__dirname, "./src")
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.endsWith(".css") || id.endsWith(".scss")) {
            return "style";
          }

          if (id.includes("node_modules")) {
            if (id.includes("fabric")) {
              return "lib.2.fabric";
            } else if (
              id.includes("@capacitor/filesystem") ||
              id.includes("@capacitor/share")
            ) {
              return "lib.2.cap";
            } else if (id.includes("zod")) {
              return "lib.2.zod";
            } else if (id.includes("@mmote/niimbluelib")) {
              return "lib.2.niim";
            } else if (id.includes("pdfjs-dist")) {
              return "lib.2.pdf";
            }

            return "lib.1.other";
          }
          return null;
        },
        chunkFileNames: () => {
          return "assets/[name].[hash].js";
        },
      },
    },
  },
});
