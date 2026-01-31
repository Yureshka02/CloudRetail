# ---------- Build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone output is best, but if you don’t use it yet, keep full app
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]
