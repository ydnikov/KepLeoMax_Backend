FROM node:22.22.3-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . ./

RUN mkdir -p uploads

EXPOSE 3000
CMD ["npm", "run", "start"]