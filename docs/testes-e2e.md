# Testes ponta a ponta

Rodam contra o ambiente do `docker compose`, pela rede, com Playwright.

## Por que existem, se já há teste de integração

Os testes de integração sobem o Nest dentro do Jest e chamam a aplicação em
processo. Eles provam o fluxo, e não provam três coisas que só o ambiente real
mostra: que a imagem sobe, que a API e o worker são processos separados que se
enxergam pela fila, e que o contrato funciona para quem está do outro lado de um
socket.

O custo dessa cobertura é que ela exige o ambiente de pé, e por isso fica fora
do `npm test`.

**Sobre o Playwright.** Não há projeto de navegador aqui, e isso é deliberado: a
Trilha A não tem interface, então a automação de navegador não tem alvo. O que
se aproveita é o executor de testes de API, que é uma biblioteca comum.

O servidor MCP do Playwright está declarado em `.mcp.json` e versionado, porque
o enunciado pede o registro dos servidores MCP, mas ele **nunca esteve ativo**:
o `.claude/settings.local.json` registra que ele foi desabilitado neste
workspace. Nada aqui passou por ele. O detalhe está em
[`docs/uso-de-ia.md`](uso-de-ia.md), junto com a correção da afirmação anterior,
que dizia que eu tinha configurado um MCP.

## Como rodar

```bash
docker compose up -d --build
npm run test:e2e
```

O teste de topologia para e sobe o container do worker, então ele precisa do
`docker compose` acessível na mesma máquina. Ele devolve o worker ao ar mesmo
quando falha.

## O que a suíte prova

| Teste | O que ele responde |
|---|---|
| raiz lista os endpoints | descoberta sem chave, e todo link absoluto responde `200` |
| `healthz` sem chave | responde e consulta o banco |
| 401 sem chave e com chave errada | a fronteira existe, e a resposta não distingue os dois casos |
| 201 com `Location` | o upload responde na hora, sem esperar o modelo |
| 400 sem `X-Sistema-Origem` | o header é obrigatório porque a idempotência é por par |
| 415 em executável chamado `rg.jpeg` | o tipo sai dos bytes, não do nome |
| 413 acima de 25 MB | o limite existe antes de gastar disco |
| 404 | id inexistente |
| campos vazios antes do resultado | lista vazia é diferente de campo com valor vazio |
| worker processa e devolve nome padronizado | os dois processos se enxergam |
| reenvio devolve 200 com 2 submissões e 1 tentativa | o fato (c) sem pagar duas vezes |
| idempotência por par sistema e chave | mesma chave em sistemas diferentes conta como dois envios |
| sem worker o documento não anda | o ADR-003 é implementação, e não afirmação |
| contrato servido bate com o versionado | o arquivo em `docs/` não é foto velha |

O teste de topologia merece explicação. O teste que espera o documento ficar
pronto passa em cerca de 100 milissegundos, e velocidade assim levanta a dúvida
certa: quem processou foi o worker, ou existe processamento escondido dentro da
API? A única resposta honesta é derrubar o worker e verificar que o documento
não anda. Ele fica em `RECEIVED`, com zero tentativas e sem campos, e volta a
andar quando o worker sobe, com o trabalho preservado.

## Resultados registrados

Executado em 01/09/2026, contra o compose recém-construído, com a saída inteira à
vista. Os números anteriores registrados aqui diziam 14 testes, e envelheceram
quando a suíte cresceu: um documento que se apresenta como registro de execução e
guarda número velho está mentindo com mais convicção do que um que não registra
nada.

### Com o adaptador padrão, BullMQ sobre Redis

```
  ✓  19 topologia.e2e.spec.ts:37:5 › sem worker o documento nao anda, e com worker ele anda (6.0s)

  19 passed (8.9s)
```

### Com `FILA_ADAPTADOR=postgres` e o Redis parado

```
SERVICE    STATUS
api        Up 14 seconds (healthy)
postgres   Up 8 hours (healthy)
worker     Up 8 seconds
                       (redis ausente)

  ✓  19 topologia.e2e.spec.ts:37:5 › sem worker o documento nao anda, e com worker ele anda (12.1s)

  19 passed (17.3s)
```

A mesma suíte, sem alterar uma linha de teste, passa contra os dois adaptadores.
É a forma mais direta que eu encontrei de tornar a afirmação do ADR-004
verificável por quem estiver lendo: a peça é trocável, e a prova é o serviço
inteiro continuar funcionando com o Redis fora do ar.

### A diferença de tempo é informação, não ruído

O mesmo teste de processamento leva cerca de 110 ms com BullMQ e cerca de 1,1 s
com o adaptador de Postgres. A causa está escrita no próprio adaptador: o BullMQ
entrega por evento e o de Postgres consulta em laço, com intervalo de um
segundo.

Não é defeito, é a escolha registrada. Neste volume, 0,11 documento por segundo,
um segundo de latência é irrelevante perto dos 5 a 40 segundos que a chamada ao
modelo leva, e o polling sobrevive a reinício sem perder aviso. A diferença
apareceria se o serviço passasse a exigir resposta rápida, e aí `LISTEN/NOTIFY`
seria o próximo passo.

## O que estes testes não cobrem

Não exercitam falha do fornecedor nem baixa confiança, porque o modo do dublê é
variável de ambiente do container e trocá-lo exige recriar o serviço no meio da
suíte. Esses caminhos estão cobertos nos testes de aplicação, com dublês em
memória, que é onde eles ficam mais rápidos e mais precisos.

Também não medem carga. O pico do fato (e) está tratado por decisão de projeto,
com a conta da concorrência registrada na especificação, e não por teste de
carga, que está declarado como não implementado.
