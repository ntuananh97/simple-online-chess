FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nodeapp

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts \
  && npm install --no-save prisma@7.8.0

COPY --from=builder --chown=nodeapp:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeapp:nodejs /app/src/generated ./src/generated

USER nodeapp

EXPOSE 5000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
