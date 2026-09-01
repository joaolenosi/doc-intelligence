# ADR-013: Contrato publicado em rota fixa e versionado no repositório

**Status:** aceita, 01/09/2026, com a revisão de 01/09/2026 no fim

## Contexto

O serviço não expunha o contrato. Quem subia o projeto abria `localhost:3000`,
recebia `404` e não tinha para onde ir. E quem fosse avaliar o projeto precisava
subir o ambiente inteiro só para descobrir a forma das respostas.

Existe uma tensão real aqui. O comportamento 5 do produto diz que o serviço é
consumido por sistemas internos e não por navegador anônimo, e o ADR-002 e o
guard global vêm de levar isso a sério. Uma rota de documentação é o caminho
mais comum de um serviço interno virar um mapa aberto do que ele expõe, e ela
costuma nascer fora da proteção porque a ferramenta a registra sozinha: o
`SwaggerModule` monta a rota no adaptador HTTP, abaixo do pipeline do Nest, e
por isso ela não passa pelo guard.

Havia inclusive um teste no projeto afirmando que não existia OpenAPI exposta.
Ele quebrou quando o Swagger entrou, que é exatamente para o que ele servia.

## Decisão

**A documentação é publicada em `/v1/docs`.** Caminho fixo, e não a raiz: a raiz
continua em `404`, sem rota e sem redirecionamento. O caminho é impresso no log
de subida e está no README, porque `404` sem pista é o problema que motivou
tudo isso.

**Ela nasce desligada.** A variável `DOCS_HABILITADO` tem padrão `false`, e o
`docker-compose.yml` liga explicitamente, com o comentário dizendo por quê. Um
ambiente que esqueça a variável nasce fechado.

**A rota fica aberta quando ligada,** sem passar pelo guard, e isso é aceito. Ela
não devolve dado de documento nenhum: descreve rotas, campos e códigos de erro,
com exemplos fictícios. Num serviço que roda na rede interna, o custo disso é
baixo e o ganho para quem integra é alto.

**O contrato também é gerado em arquivo,** por `npm run contrato:gerar`, a partir
da própria aplicação, e versionado em `docs/contrato-openapi.json`.

## Alternativas consideradas

**Não expor nada, e deixar o contrato só na especificação escrita.** Era o estado
anterior. Descartada porque a especificação é prosa e envelhece: ela descreve a
intenção, e o contrato precisa descrever o que o código faz hoje.

**Publicar sempre, com padrão ligado.** É o que quase todo projeto faz, e é mais
conveniente. Descartada pelo motivo que originou esta decisão: o pedido explícito
foi que a documentação não ficasse aberta porque ninguém olhou. Com padrão
ligado, o estado aberto é o silêncio; com padrão desligado, ele é uma linha que
alguém escreveu e outra pessoa pode revisar.

**Proteger a documentação com a mesma chave de API.** Foi a que eu mais
considerei, porque é coerente com o resto: a fronteira existe, e exceção é
declarada. Descartada por um motivo prático que não dá para contornar bem. O
Swagger é uma página que o navegador carrega e que depois busca o JSON sozinha,
e o navegador não tem como mandar `X-API-Key` nessas requisições sem um
intermediário. Proteger significaria, na prática, uma tela de erro no lugar da
documentação. Preferi manter a rota aberta e desligada por padrão a construir
uma proteção que não protege e atrapalha.

**Escrever o arquivo do contrato à mão.** Descartada porque contrato escrito à
mão diverge do código na terceira alteração, e um contrato que mente é pior do
que contrato nenhum: ele é acreditado.

## Consequências

Quem for avaliar lê `docs/contrato-openapi.json` sem subir nada.

Qualquer mudança na forma de uma resposta vira diferença no controle de versão,
que é o efeito principal de versionar o arquivo. Para isso valer, existe um teste
que gera o contrato e compara com o arquivo: se alguém mudar a forma e esquecer
de regerar, a suíte falha. Sem esse teste, o arquivo viraria uma foto que
envelhece em silêncio, que é o problema que ele deveria resolver.

As classes de DTO existem só para descrever o contrato, e quem monta a resposta
continua sendo o apresentador. Isso cria uma duplicação possível entre a forma
documentada e a forma real, e por isso existe um teste de integração que compara
as chaves da resposta de verdade com as chaves documentadas.

O teste de fronteira de autenticação foi reescrito, e não apagado. Ele deixou de
afirmar que não existe OpenAPI e passou a afirmar o que continua valendo: que a
documentação nasce desligada e que ela não mora na raiz.

O script de geração não sobe servidor, não conecta no banco e não fala com o
Redis, então ele roda em qualquer máquina recém clonada. O custo é que ele
carrega o grafo inteiro da aplicação, e o teste que o usa é o mais lento da
suíte de unidade.

## Revisão de 01/09/2026: a raiz deixou de responder 404

A decisão acima dizia que a raiz continuaria em `404`, sem rota e sem
redirecionamento. Isso durou pouco, e eu prefiro registrar a mudança a reescrever
o texto original como se ela nunca tivesse existido.

**O que motivou.** O `404` resolvia um problema, que era não existir rota
escondida na raiz, e não resolvia o outro, que era o que originou este ADR:
alguém sobe o serviço, abre `localhost:3000` e não sabe para onde ir. Publicar a
documentação em `/v1/docs` e imprimir o caminho no log ajuda quem lê o log.
Quem abre o navegador continuava sem pista.

**O que mudou.** A raiz passou a listar os endpoints, no estilo da raiz da API do
GitHub. Ela devolve link absoluto para as duas coisas que se abrem no navegador,
saúde e documentação, montados a partir do próprio pedido para funcionarem atrás
de proxy ou em outra porta. O link da documentação vem nulo quando
`DOCS_HABILITADO` está desligado, porque anunciar um caminho que responde `404`
seria pior do que não anunciar nada.

As operações da API vêm como método e template, e não como link absoluto. Isso
saiu de um erro que eu cometi e corrigi ao seguir os próprios links: a primeira
versão anunciava `.../v1/documentos` como URL, e essa rota só aceita `POST`, então
quem clicasse receberia `404`. Uma raiz de descoberta que anuncia link quebrado é
pior do que raiz nenhuma, e hoje existe um teste ponta a ponta que segue cada
link absoluto e cobra `200`.

**E ela ficou fora da autenticação,** que é a segunda exceção do projeto ao lado
de `/healthz`. Com o guard, quem abrisse a raiz receberia `401`, que é pior do
que `404` para o único propósito da rota. Ela não devolve dado de documento
nenhum: são os mesmos caminhos que qualquer pessoa descobriria lendo a
documentação.

**O que continua valendo do texto original.** Tudo o mais: a documentação em
caminho fixo, o padrão desligado, o contrato gerado e versionado, e o teste que
compara o arquivo com o que a aplicação produz.

**Dois testes quebraram, e os dois estavam certos.** O de contrato afirmava que
não havia rota na raiz, e o de fronteira de autenticação afirmava que só existia
uma exceção. Os dois foram reescritos para afirmar o novo estado, com a lista de
exceções literal, para uma terceira não entrar sem alguém escrever o nome dela.
