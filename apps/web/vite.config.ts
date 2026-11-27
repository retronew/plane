import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildVersionPlugin } from "./lib/build-version-plugin.ts";

const buildId = randomUUID();
import * as dotenv from "dotenv";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });

// Expose only vars starting with VITE_
const viteEnv = Object.keys(process.env)
  .filter((k) => k.startsWith("VITE_"))
  .reduce<Record<string, string>>((a, k) => {
    a[k] = process.env[k] ?? "";
    return a;
  }, {});

export default defineConfig(() => ({
  define: {
    "process.env": JSON.stringify(viteEnv),
    __PLANE_WEB_BUILD_ID__: JSON.stringify(buildId),
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router",
      "mobx",
      "mobx-react",
      "mobx-utils",
      "swr",
      "axios",
      "lodash-es",
      "date-fns",
      "clsx",
      "lucide-react",
      "@makeplane/propel/icons",
      "@base-ui/react",
    ],
  },
  build: {
    assetsInlineLimit: 4096,
  },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              minSize: 30_000,
              groups: [
                {
                  name: "vendor-react",
                  test: /node_modules[\\/](react|react-dom|react-router|scheduler|swr)[\\/]/,
                  priority: 50,
                },
                {
                  name: "vendor-state",
                  test: /node_modules[\\/](mobx|mobx-react|mobx-utils|axios|lodash-es|date-fns|clsx|uuid)[\\/]/,
                  priority: 45,
                },
                {
                  name: "vendor-ui",
                  test: /node_modules[\\/](@makeplane[\\/]propel|@base-ui|lucide-react|cmdk|next-themes|overlayscrollbars|@tanstack)[\\/]/,
                  priority: 40,
                },
                {
                  debugName: "i18n-locale",
                  name: (id: string) => {
                    const match = id.match(/packages[\\/]i18n[\\/]locales[\\/]([^\\/]+)[\\/]/);
                    return match ? `i18n-${match[1]}` : undefined;
                  },
                  test: /packages[\\/]i18n[\\/]locales[\\/]/,
                  priority: 25,
                },
                {
                  name: "plane-shared",
                  test: /packages[\\/](constants|utils|types|hooks|services|shared-state|blocks)[\\/]/,
                  priority: 20,
                },
                {
                  name: "app-shared",
                  test: /apps[\\/]web[\\/](store|services|helpers|hooks|lib|layouts)[\\/]/,
                  minShareCount: 2,
                  priority: 15,
                },
                {
                  name: "app-components",
                  test: /apps[\\/]web[\\/]components[\\/](?!(editor|pages|analytics|exporter)[\\/])/,
                  minShareCount: 2,
                  priority: 12,
                },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [reactRouter(), buildVersionPlugin(buildId)],
  resolve: {
    // Native replacement for vite-tsconfig-paths; reads this app's tsconfig.json
    tsconfigPaths: true,
    alias: {
      // Next.js compatibility shims used within web
      "next/link": path.resolve(import.meta.dirname, "app/compat/next/link.tsx"),
      "next/navigation": path.resolve(import.meta.dirname, "app/compat/next/navigation.ts"),
      "next/script": path.resolve(import.meta.dirname, "app/compat/next/script.tsx"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    headers: { "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'" },
  },
  ssr: {
    // Bundle directory-based entry points for Node during SPA fallback prerendering.
    noExternal: [
      "@atlaskit/pragmatic-drag-and-drop",
      "@atlaskit/pragmatic-drag-and-drop-hitbox",
      "@atlaskit/pragmatic-drag-and-drop-auto-scroll",
    ],
  },
}));
