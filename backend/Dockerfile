FROM node:24.14.0-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /uploads && chown node:node /uploads
USER node
EXPOSE 3001
CMD ["npm","start"]
