FROM node:26-bookworm-slim AS dependencies
# npm install -g, not `corepack enable && corepack prepare`: this image's base was bumped from
# node:22-bookworm-slim to node:26-bookworm-slim by an independent Dependabot PR while this fix
# was already in flight - and Node dropped Corepack from the default install starting with Node
# 25, so `corepack enable` fails with "corepack: not found" on this base image (the exact failure
# already hit and fixed the same way in apps/web/Dockerfile - see docs/20-TESTS-ENTREPRISE.md).
# npm itself is bundled regardless of Corepack's fate, so this survives the next base-image bump
# too.
RUN npm install -g pnpm@9.15.0
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

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
# npm ships inside the base Node.js image for building/installing (corepack no longer does, as of
# node:26-bookworm-slim - see the `dependencies` stage above) - this runtime stage never invokes
# either (CMD only ever runs `node`), yet npm's own bundled dependencies (it vendors its own tar,
# brace-expansion, etc., entirely unrelated to this app's pnpm-lock.yaml) were showing up as
# CRITICAL/HIGH findings in the Trivy image scan - confirmed by diffing their exact "Installed
# Version" against what ships inside a real Node install's own lib/node_modules/npm, not guessed.
# Removing what is never used at runtime is the actual fix, not chasing each of npm's own
# transitive CVEs one at a time as they're disclosed upstream. `rm -f` on corepack's binaries is a
# harmless no-op on this base image now that it doesn't ship them - kept so this stays correct if
# a future base image brings Corepack back.
RUN rm -rf /usr/local/lib/node_modules && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
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
