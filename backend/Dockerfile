# API SamaStat. Image Debian (glibc) requise par onnxruntime-node (embeddings locaux).
FROM node:24-bookworm-slim AS build
WORKDIR /app
# npm ci exige les manifestes de tous les workspaces référencés par le lockfile.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY mobile/package.json mobile/
RUN npm ci --workspace backend
COPY backend backend
RUN npm run --workspace backend build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY mobile/package.json mobile/
# tsx reste installé pour les scripts de migration / seed / index dans le conteneur.
RUN npm ci --workspace backend --omit=dev \
  && npm install --no-save --no-package-lock tsx \
  && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY backend/scripts backend/scripts
COPY backend/src/database backend/src/database
COPY backend/src/indicators/embedding.ts backend/src/indicators/embedding.ts
COPY backend/tsconfig.json backend/tsconfig.json
WORKDIR /app/backend
ENV SAMASTAT_MODELS_DIR=/models
VOLUME ["/models"]
EXPOSE 3001
CMD ["node", "--enable-source-maps", "dist/main"]
