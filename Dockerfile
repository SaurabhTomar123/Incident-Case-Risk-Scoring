FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV PORT=3000 DB_PATH=/app/data/app.db NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
