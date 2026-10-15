FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
ENV API_URL=http://api:4000
RUN npm run build -w @rto/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@rto/web"]
