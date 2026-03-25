# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Set production backend URL
ENV REACT_APP_BACKEND_URL=https://yachtassist-mvp-production.up.railway.app

# Build the app
RUN yarn build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 3000 (Railway will map this)
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
