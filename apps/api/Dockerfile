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
# `pnpm install --frozen-lockfile` above is workspace-wide, not scoped to @fodip/api: it resolves
# and installs every package's dependencies - apps/web's devDependencies (Playwright, Next's
# toolchain...) included - into this same shared node_modules, because pnpm workspaces hoist and
# link across the whole workspace by default. A naive `COPY node_modules` into the runtime image
# would ship all of that. `pnpm deploy --prod` builds a fresh, package-scoped node_modules
# containing only what @fodip/api itself declares in "dependencies" (verified: the deploy output
# starts the compiled server correctly, and a scan of its node_modules found zero copies of any
# devDependency - jest, eslint, @nestjs/cli and its own webpack/glob/picomatch/ajv chain, all
# absent - the exact class of finding Trivy's image scan caught here before this fix).
RUN pnpm --filter @fodip/api deploy --prod /app/deploy

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/deploy/dist ./dist
COPY --from=build /app/deploy/package.json ./package.json
COPY --from=build /app/deploy/scripts ./scripts
# database/ isn't needed to run the API, only to run migrate.js as a one-off job/shell command
# against a hosted database after a deploy - see docs/15-DEPLOIEMENT-TEST.md.
COPY database ./database
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
