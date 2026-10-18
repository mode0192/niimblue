import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const getDate = (): string => {
  const date = new Date();
  const fmt = (n: number) => (n > 9 ? n : `0${n}`);
  return `${date.getFullYear()}-${fmt(date.getMonth() + 1)}-${fmt(date.getDate())}`;
};

const REPO_URL = "https://github.com/MultiMote/niimblue";

// Link to the branch this build was made from. Falls back to the repository root
// if the branch is unknown (no git, or detached HEAD).
const getSourceUrl = (): string => {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    if (branch && branch !== "HEAD") {
      return `${REPO_URL}/tree/${branch.split("/").map(encodeURIComponent).join("/")}`;
    }
  } catch {
    // not a git checkout, or git is not installed
  }
  return REPO_URL;
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
