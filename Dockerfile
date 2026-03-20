# Bước 1: Build ứng dụng
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Chỉ copy file package để tận dụng layer cache
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm cả devDeps để build)
RUN npm install

# Copy source code và build
COPY . .
RUN npm run build

# Bước 2: Chạy ứng dụng (Production image)
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy các file cần thiết cho runtime
COPY package*.json ./
RUN npm install --only=production

# Copy thư mục build từ step builder - NestJS build ra dist/src
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

# Chạy main.js trong dist/src
CMD ["node", "dist/src/main.js"]