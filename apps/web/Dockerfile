FROM node:22-bookworm-slim AS dependencies
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY apps/web apps/web
RUN pnpm --filter @fodip/web build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --chown=node:node --from=build /app/apps/web/.next ./apps/web/.next
USER node
EXPOSE 3000
# Shell form (not exec/JSON form) so ${PORT} is actually substituted: docker-compose never sets
# it (falls back to 3000, unchanged), but a host like Render assigns its own PORT and expects the
# container to bind to it.
CMD node apps/web/node_modules/next/dist/bin/next start apps/web -p ${PORT:-3000}
