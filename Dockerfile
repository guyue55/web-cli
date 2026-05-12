FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

COPY packages ./packages
COPY backend ./backend
COPY frontend ./frontend

RUN npm -w @web-cli/shared run build
RUN npm -w backend run build
RUN npm -w frontend run build

FROM node:20-bookworm-slim AS backend-runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN npm install -g @google/gemini-cli

COPY --from=build /app/backend ./backend
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

USER node

CMD ["node", "backend/dist/index.js"]

FROM caddy:2-alpine AS caddy-runtime

COPY --from=build /app/frontend/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
