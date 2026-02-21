FROM node:18-alpine

WORKDIR /app

# 1. Install dependencies
# We need to copy package.json first for caching
COPY worker/package.json ./worker/
WORKDIR /app/worker
RUN npm install

# 2. Copy source code
COPY worker/ ./

# 3. Copy Prisma Schema from root (Build context must be project root!)
COPY prisma/ ../prisma/

# 4. Copy Shared Code (lib & config)
COPY lib/ ../lib/
COPY config/ ../config/

# 5. Generate Prisma Client
RUN npx prisma generate --schema=../prisma/schema.prisma

# 6. Build TypeScript
RUN npm run build

# 6. Start
CMD ["npm", "start"]
