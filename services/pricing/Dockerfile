# ---------- Build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build --if-present

# ---------- Runtime ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app /app

# If you build (TypeScript), you probably run dist/main.js or dist/index.js
# If you don't build, you run src/index.js
# Adjust CMD to your app. This is a common default:
EXPOSE 8080
CMD ["npm", "start"]
