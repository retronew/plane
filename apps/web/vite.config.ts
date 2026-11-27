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
                  test: /node_modules[\\/](@makeplane[\\/]propel|@base-ui|lucide-react|cmdk|next-themes|overlayscrollbars|@tanstack|@floating-ui)[\\/]/,
                  priority: 40,
                },
                {
                  debugName: "i18n-locale",
                  name: (id: string) => {
                    const match = id.match(/packages[\\/]i18n[\\/]locales[\\/]([^\\/]+)[\\/]/);
                    return match ? `i18n-${match[1]}` : undefined;
                  },
                  test: /packages[\\/]i18n[\\/]locales[\\/]/,
                  priority: 35,
                },
                {
                  name: "plane-shared",
                  test: /packages[\\/](constants|utils|types|hooks|services|shared-state)[\\/]|packages[\\/]blocks[\\/]dist[\\/](auth|breadcrumb|card|common|context-menu|dialog|emoji-reaction|icons|layout|pill-button|portal|property-select|select|skeleton|spinner|toast|types|utils|virtual-list)[\\/]/,
                  priority: 30,
                },
                {
                  name: "app-shared",
                  test: /apps[\\/]web[\\/](store[\\/](?!pages[\\/])|services|helpers|hooks[\\/](?!(editor|pages|use-collaborative-page-actions))|lib|layouts)/,
                  minShareCount: 2,
                  priority: 25,
                },
                {
                  name: "app-components",
                  test: /apps[\\/]web[\\/]components[\\/](?!(editor|pages|analytics|active-cycles|exporter|modals|settings|inbox|profile|cycles|modules|views|workflow|comments|stickies|workspace-notifications|project[\\/](create|overview|form)|core[\\/]description-versions|power-k[\\/]ui|issues[\\/](issue-detail|issue-detail-widgets|issue-modal|peek-overview))[\\/])/,
                  minShareCount: 2,
                  priority: 20,
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
