import path from "node:path";
import * as dotenv from "dotenv";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { joinUrlPath } from "@plane/utils";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });

// Expose only vars starting with VITE_
const viteEnv = Object.keys(process.env)
  .filter((k) => k.startsWith("VITE_"))
  .reduce<Record<string, string>>((a, k) => {
    a[k] = process.env[k] ?? "";
    return a;
  }, {});

const basePath = joinUrlPath(process.env.VITE_ADMIN_BASE_PATH ?? "", "/") ?? "/";

export default defineConfig(() => ({
  base: basePath,
  define: {
    "process.env": JSON.stringify(viteEnv),
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
                  test: /node_modules[\\/](@makeplane[\\/]propel|@base-ui|lucide-react|next-themes|@floating-ui)[\\/]/,
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
                  test: /packages[\\/](constants|utils|types|hooks|services|shared-state|blocks)[\\/]/,
                  priority: 30,
                },
                {
                  name: "app-shared",
                  test: /apps[\\/]admin[\\/](core|ce)[\\/]/,
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
  plugins: [
    {
      name: "admin-base-path-redirect",
      configureServer(server) {
        const baseWithoutSlash = basePath.replace(/\/+$/, "");
        if (!baseWithoutSlash) return;
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          if (url.pathname !== baseWithoutSlash) return next();
          res.writeHead(302, { Location: `${basePath}${url.search}` });
          res.end();
        });
      },
    },
    reactRouter(),
  ],
  resolve: {
    // Native replacement for vite-tsconfig-paths; reads this app's tsconfig.json
    tsconfigPaths: true,
    alias: {
      // Next.js compatibility shims used within admin
      "next/link": path.resolve(import.meta.dirname, "app/compat/next/link.tsx"),
      "next/navigation": path.resolve(import.meta.dirname, "app/compat/next/navigation.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
  },
  // No SSR-specific overrides needed; alias resolves to ESM build
}));
