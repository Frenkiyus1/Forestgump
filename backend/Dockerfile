# --- Stage 1: build TypeScript -> dist/ ---
FROM node:22-alpine AS builder
WORKDIR /app

# Cài đầy đủ deps (gồm devDeps để có tsc) dựa trên lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Biên dịch.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Stage 2: runtime gọn (chỉ prod deps + dist) ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Healthcheck gọi endpoint /health của chính service.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.API_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
