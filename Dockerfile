FROM imbios/bun-node
WORKDIR /usr/src/catgpt
RUN mkdir server
ADD ./server/package.json ./server/package.json
ADD ./server/bun.lockb ./server/bun.lockb
WORKDIR /usr/src/catgpt/server
RUN bun install
COPY ./server .
ADD types.ts /usr/src/catgpt/types.ts
RUN npx prisma generate
CMD ["bun", "run", "./src/index.ts"]
