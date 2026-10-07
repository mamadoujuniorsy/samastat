# Frontend web SamaStat (Next.js, sortie standalone).
FROM node:24-alpine AS build
WORKDIR /app
# npm ci exige les manifestes de tous les workspaces référencés par le lockfile.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY mobile/package.json mobile/
RUN npm ci --workspace frontend
COPY frontend frontend
ARG NEXT_PUBLIC_API_URL=http://api:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run --workspace frontend build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "frontend/server.js"]
