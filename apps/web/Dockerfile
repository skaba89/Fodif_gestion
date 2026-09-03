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
# `pnpm install --frozen-lockfile` above is workspace-wide, not scoped to @fodip/web: it resolves
# and installs every package's dependencies - apps/api's devDependencies (@nestjs/cli, ts-jest...)
# included - into this same shared node_modules, because pnpm workspaces hoist and link across
# the whole workspace by default. A naive `COPY node_modules` into the runtime image would ship
# all of that. `pnpm deploy --prod` builds a fresh, package-scoped node_modules containing only
# what @fodip/web itself declares in "dependencies" (verified: the deploy output serves the built
# app correctly with `next start`, and a scan of its node_modules found zero copies of any
# devDependency - the exact class of finding Trivy's image scan caught here before this fix).
RUN pnpm --filter @fodip/web deploy --prod /app/deploy

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/deploy/package.json ./package.json
COPY --chown=node:node --from=build /app/deploy/.next ./.next
# Unlike .next, Next.js reads public/ straight off disk at request time rather than bundling it
# into the build output - omitting this copy step made every file under apps/web/public/ (axe D2:
# manifest.webmanifest, sw.js, the icons) 404 in the actual container while working fine outside
# Docker, where the full source tree (public/ included) is already on disk. Caught by CI, not by
# local verification run straight from the repo checkout - real root cause, confirmed by
# reproducing the same 404 locally after temporarily removing apps/web/public/ and serving with
# `next start` from that stripped directory.
COPY --chown=node:node --from=build /app/deploy/public ./public
USER node
EXPOSE 3000
# Shell form (not exec/JSON form) so ${PORT} is actually substituted: docker-compose never sets
# it (falls back to 3000, unchanged), but a host like Render assigns its own PORT and expects the
# container to bind to it.
CMD node node_modules/next/dist/bin/next start -p ${PORT:-3000}
