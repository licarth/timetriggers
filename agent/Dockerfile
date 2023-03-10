# base node image
FROM node:18-bullseye-slim as base
RUN npm install -g json

# Install all node_modules, including dev dependencies
FROM base as deps

RUN mkdir /app
WORKDIR /app

####### 
ADD package.json package-lock.json ./
ADD copy-of-domain ./copy-of-domain
# replace package @timetriggers/domain with local link
RUN json -I -f package.json -e "this.dependencies[\"@timetriggers/domain\"]=\"file:./copy-of-domain\""
#######

RUN npm install --production=false

# Setup production node_modules
FROM base as production-deps

RUN mkdir /app
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules

####### 
ADD package.json package-lock.json ./
ADD copy-of-domain ./copy-of-domain
# replace package @timetriggers/domain with local link
RUN json -I -f package.json -e "this.dependencies[\"@timetriggers/domain\"]=\"file:./copy-of-domain\""
#######

RUN npm prune --production

FROM deps as build
ADD src/ src/
ADD tsconfig.json ./

RUN npm run build

# Finally, build the production image with minimal footprint
FROM base as final
# Install curl 
RUN apt-get update && apt-get install -y curl
# Cleanup apt-get deps
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl \
    && chmod +x ./kubectl \
    && mv ./kubectl /usr/local/bin/kubectl

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app



COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/built /app/built
ADD copy-of-domain ./copy-of-domain

ADD package.json ./

CMD ["npm", "run", "start"]
