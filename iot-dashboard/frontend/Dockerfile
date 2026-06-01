FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Geliştirme ortamı için (development mode)
EXPOSE 3000
CMD ["npm", "start"]
