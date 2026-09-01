# Imagem unica para a API e para o worker.
#
# Sao dois processos, e nao dois artefatos: o codigo e o mesmo e o que muda e o
# comando. Duas imagens exigiriam manter duas listas de dependencia em sincronia
# para separar coisas que sempre mudam juntas.
FROM node:22-alpine

WORKDIR /app

# As dependencias entram antes do codigo para a camada ser reaproveitada entre
# builds em que so o codigo mudou.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# O TypeScript compila os prompts para fora do dist, porque eles nao sao codigo.
RUN npm run build && cp -r src/infraestrutura/ia/prompts dist/src/infraestrutura/ia/prompts

# O servico nao roda como root. Ele grava documento de cliente em disco, e um
# processo com mais permissao do que precisa e a diferenca entre um bug e um
# incidente.
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node

CMD ["node", "dist/src/main.js"]
