FROM oven/bun:1 as base
WORKDIR /usr/src/catgpt
FROM base AS install
RUN mkdir server
ADD ./server/package.json ./server/package.json
ADD ./server/bun.lockb ./server/bun.lockb
WORKDIR /usr/src/catgpt/server
RUN bun install --frozen-lockfile --production
ADD types.ts /usr/src/catgpt/types.ts
COPY ./server ./
RUN bunx prisma generate
RUN bun build ./src/index.ts --compile --outfile catgpt
FROM base AS release
WORKDIR /usr/bin/catgpt
COPY --from=install /usr/src/catgpt/server/catgpt .