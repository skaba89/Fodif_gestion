FROM node:24-bookworm-slim AS dependencies
# npm install -g, not `corepack enable && corepack prepare`: this image was previously bumped to
# node:26-bookworm-slim by an independent Dependabot PR, where `corepack enable` fails with
# "corepack: not found" - Node dropped Corepack from the default distribution starting with Node
# 25 (kept as experimental through the 24.x LTS line this image now pins - see
# https://github.com/nodejs/corepack/issues/722). npm itself is bundled on every Node line
# regardless of Corepack's fate, so this survives whichever line the base image tracks next.
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

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
# npm (and, on this 24.x line, Corepack too - see the `dependencies` stage above) ships inside the
# base Node.js image for building/installing - this runtime stage never invokes any of them (CMD
# only ever runs `node`), yet npm's own bundled dependencies (it vendors its own tar,
# brace-expansion, etc., entirely unrelated to this app's pnpm-lock.yaml) were showing up as
# CRITICAL/HIGH findings in the Trivy image scan - confirmed by diffing their exact "Installed
# Version" against what ships inside a real Node install's own lib/node_modules/npm, not guessed.
# Removing what is never used at runtime is the actual fix, not chasing each of npm's own
# transitive CVEs one at a time as they're disclosed upstream.
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
