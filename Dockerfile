FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/

RUN npm install --ignore-scripts 2>/dev/null; npm install tsx sql.js express cors helmet jsonwebtoken bcryptjs zod speakeasy qrcode cookie-parser dotenv 2>/dev/null

COPY packages/backend ./packages/backend
COPY .env.example .env

RUN mkdir -p /app/packages/backend/data

EXPOSE 3000

CMD ["npx", "tsx", "packages/backend/src/index.ts"]
