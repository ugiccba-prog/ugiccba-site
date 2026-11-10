FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY *.cjs activities.json ./
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "index.cjs"]
