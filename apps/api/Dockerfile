FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @plandelta/api... build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=build /app /app
RUN mkdir -p /data && chmod 0777 /data
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
