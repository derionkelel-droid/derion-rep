FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @workspace/db run build
RUN pnpm --filter @workspace/api-server run build

FROM base AS release
WORKDIR /app
COPY --from=build /app/pnpm-lock.yaml /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/lib/db ./lib/db
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/lib/db/node_modules ./lib/db/node_modules
COPY --from=build /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules

EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
