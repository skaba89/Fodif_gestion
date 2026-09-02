FROM node:22-bookworm-slim AS dependencies
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY apps/api apps/api
RUN pnpm --filter @fodip/api build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/scripts ./apps/api/scripts
# database/ isn't needed to run the API, only to run migrate.js as a one-off job/shell command
# against a hosted database after a deploy - see docs/15-DEPLOIEMENT-TEST.md.
COPY database ./database
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
