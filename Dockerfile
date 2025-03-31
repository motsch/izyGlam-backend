FROM node:18

RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x ./scripts/wait-for-it.sh

EXPOSE 3000

CMD ["npx", "ts-node", "src/index.ts"]