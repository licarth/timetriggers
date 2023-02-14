# base node image
FROM node:16-bullseye-slim as base
RUN npm install -g json

# set for base and all layer that inherit from it
ENV NODE_ENV production

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl
WORKDIR /myapp

#######
ADD package.json package-lock.json .npmrc ./
ADD copy-of-domain ./copy-of-domain
# replace package @timetriggers/domain with local link
RUN json -I -f package.json -e "this.dependencies[\"@timetriggers/domain\"]=\"file:./copy-of-domain\""
#######

# Install all node_modules, including dev dependencies
FROM base as deps

RUN npm install --production=false

# Setup production node_modules
FROM base as production-deps

COPY --from=deps /myapp/node_modules /myapp/node_modules

RUN npm prune --production

# Build the app
FROM base as build

WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules

ADD . .
#######
# replace package @timetriggers/domain with local link
RUN json -I -f package.json -e "this.dependencies[\"@timetriggers/domain\"]=\"file:./copy-of-domain\""
#######

RUN npm run build

# Finally, build the production image with minimal footprint
FROM base

WORKDIR /myapp

COPY --from=production-deps /myapp/node_modules /myapp/node_modules

COPY --from=build /myapp/build /myapp/build
COPY --from=build /myapp/public /myapp/public
ADD . .

CMD ["npm", "start"]
