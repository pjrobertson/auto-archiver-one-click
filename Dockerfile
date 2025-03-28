FROM bellingcat/auto-archiver:latest AS base


# install next.js
RUN npm install

entrypoint ["npm", "run", "dev"]