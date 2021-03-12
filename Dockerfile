FROM node:15.10.0
WORKDIR /usr/proj
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
