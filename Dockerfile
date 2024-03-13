FROM imbios/bun-node
WORKDIR /usr/src/catgpt
RUN mkdir server
ADD ./server/package.json ./server/package.json
ADD ./server/bun.lockb ./server/bun.lockb
WORKDIR /usr/src/catgpt/server
RUN bun install
WORKDIR /usr/src/catgpt/web
ADD ./web/package.json ./package.json
ADD ./web/bun.lockb ./bun.lockb
RUN bun install
ADD types.ts /usr/src/catgpt/types.ts
COPY ./web .
RUN bun run build
WORKDIR /usr/src/catgpt/server
COPY ./server .
RUN npx prisma generate
ARG version
ENV CATGPT_VERSION=$version
ADD run.sh /usr/src/catgpt/run.sh
RUN chmod +x /usr/src/catgpt/run.sh
CMD ["/usr/src/catgpt/run.sh"]
