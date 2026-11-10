# syntax=docker/dockerfile:1
# Imagen compartida para ejecutar las tres aplicaciones en el entorno local.
FROM node:24-bookworm-slim

ARG PNPM_VERSION=11.6.0
RUN npm install --global pnpm@${PNPM_VERSION}

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development

# Los manifiestos se copian antes del código para reutilizar las dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/store/package.json ./apps/store/package.json
COPY apps/console/package.json ./apps/console/package.json
COPY apps/dealer/package.json ./apps/dealer/package.json
COPY packages/db-types/package.json ./packages/db-types/package.json
COPY packages/maps/package.json ./packages/maps/package.json
COPY packages/supabase/package.json ./packages/supabase/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/validation/package.json ./packages/validation/package.json
COPY e2e/package.json ./e2e/package.json
RUN --mount=type=cache,id=rapitrip-pnpm,target=/pnpm/store \
    pnpm --filter '@rapitrip/store...' --filter '@rapitrip/console...' \
    --filter '@rapitrip/courier...' install --frozen-lockfile --store-dir /pnpm/store

COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
COPY --chown=node:node scripts/docker ./scripts/docker

USER node
EXPOSE 3000 3001 3002
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=4 \
    CMD node /app/scripts/docker/healthcheck.mjs
ENTRYPOINT ["node", "/app/scripts/docker/start.mjs"]
CMD ["store"]
