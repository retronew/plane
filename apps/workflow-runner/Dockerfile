# syntax=docker/dockerfile:1
FROM node:22.22.0-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/workflow-runner/package.json apps/workflow-runner/package.json
RUN pnpm install --filter @plane/workflow-runner --frozen-lockfile --ignore-scripts
COPY apps/workflow-runner/tsconfig.json apps/workflow-runner/tsconfig.json
COPY apps/workflow-runner/src apps/workflow-runner/src
RUN pnpm --filter @plane/workflow-runner build
# pnpm deploy isolates the runner dependency closure from the application tree.
RUN pnpm --filter @plane/workflow-runner deploy --legacy --prod /runner

FROM node:22.22.0-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
WORKDIR /runner
COPY --from=build --chown=node:node /runner /runner
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "--input-type=module", "-e", "const response = await fetch('http://127.0.0.1:8080/healthz'); if (!response.ok) process.exit(1)"]
CMD ["node", "dist/server.js"]
