# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Cache bust to force fresh build
ARG CACHE_BUST=20260331v4
RUN echo "Cache bust: $CACHE_BUST"

COPY package.json ./
RUN yarn install --no-frozen-lockfile

COPY . .

# Build-time env vars
ARG REACT_APP_BACKEND_URL=https://yachtassist-mvp-production.up.railway.app
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV NODE_ENV=production

RUN yarn build

# Production stage
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
