# Análise de requisitos

> Documento escrito antes de qualquer linha de código, em 31/08. É o meu
> rascunho de leitura do enunciado: o que eu entendi, o que eu decidi já aqui,
> o que deixei em aberto e o que eu não vou fazer. Onde a implementação
> divergir disso, o registro fica na especificação e nos ADRs; este arquivo
> não vai ser reescrito depois para parecer que eu já sabia.

## O que eu escolhi

Trilha A. Escolhi backend porque é o trabalho que eu quero fazer, e porque o
problema interessante desse desafio está do lado de cá: o fornecedor lento e
instável, o arquivo que não dá para confiar, o reenvio, o pico das 9h. A
interface consome o contrato que eu expuser, e o contrato é meu problema.

Stack: Node com TypeScript e NestJS. Escolho porque é onde eu produzo mais
rápido em três dias, e porque o NestJS já me dá de graça a fronteira de
módulos e a injeção de dependência que eu ia ter que montar na mão para
conseguir trocar o fornecedor de IA sem mexer no núcleo. Isso é uma escolha de
velocidade e de familiaridade, não uma tese de que é a melhor ferramenta para
o problema. Um Go ou um Python com FastAPI resolveriam também.

## Arquitetura, fechada antes deste documento

Parte do desenho eu já tinha resolvido numa análise anterior, antes de abrir o
repositório. Trago para cá porque é decisão tomada, e não intuição a avaliar
depois.

Arquitetura hexagonal, portas e adaptadores, com uma regra de dependência só. O
domínio não importa framework nenhum. A aplicação importa o domínio e define as
portas, que são interfaces. A infraestrutura importa a aplicação e implementa
as portas, e é o único lugar onde Nest, banco, fila, disco e cliente HTTP têm
permissão para existir.

A aplicação também fica livre de framework, e isso não sai de graça. Os casos
de uso viram classes comuns, sem decorator, recebendo tudo pelo construtor, e a
ligação entre porta e adaptador vira fábrica escrita à mão nos módulos do Nest.
Aceitei esse custo por dois motivos. O primeiro é o fato (f): o modelo do
fornecedor vai trocar de versão e os prompts vão mudar mais de uma vez no
primeiro ano, e a porta é o que faz essa troca não encostar no núcleo. Ela
também cobre a troca do fornecedor inteiro, que é um caso mais forte do que o
enunciado promete. O segundo é o custo de teste: um
caso de uso que se instancia com `new` não precisa de contexto do Nest para ser
testado, e em três dias isso decide quantos testes eu consigo escrever.

A alternativa que descartei foi a camada padrão do Nest, com serviço decorado
injetado no controller e repositório do TypeORM dentro do serviço. É mais
rápida de escrever e é o que eu faria num CRUD. Descartei porque aqui a peça
que mais precisa ser trocável é justamente a mais funda, e porque 30% da nota é
exatamente "o que acontece quando uma peça precisa ser trocada". Escrever
fábrica à mão é o preço, e eu prefiro pagá-lo a argumentar que a fronteira
existe sem ela existir.

Para a fronteira não virar promessa, vai existir um teste que varre o domínio e
a aplicação procurando importação de framework e falha se achar alguma. Regra
de arquitetura sem teste que a defenda é comentário.

As convenções de nomenclatura, incluindo tabela e coluna em português com
prefixo formado pelas iniciais da tabela, vieram da mesma análise. Estão no
`CLAUDE.md`, porque quem precisa obedecê-las a cada arquivo é o agente, e o
mapa de prefixos vai para a especificação.

## O problema, do meu jeito

O serviço recebe um arquivo (imagem ou PDF) de outro sistema interno, manda
para um modelo multimodal que diz que tipo de documento é e extrai os campos
daquele tipo, guarda o resultado e deixa consultar depois. Quando o modelo não
tem confiança no que produziu, o documento não pode entrar como pronto: ele
para numa fila para alguém do atendimento conferir.

Do produto-alvo inteiro, a fatia que eu vou implementar é:

**receber → validar → persistir → enfileirar → processar (com dublê) →
persistir resultado → consultar por id.**

A conferência humana e a listagem ficam de fora da implementação, mas não
ficam de fora do projeto: o modelo de estados e o contrato precisam já
comportar as duas, senão elas viram refatoração e não continuação.

## O que eu vi no cenário

Fui atrás dos fatos do enunciado um a um, porque está escrito lá que eles não
pedem funcionalidade, e é justamente aí que um projeto ingênuo quebra.

**O processamento é lento e caro.** De 5 a 40 segundos por chamada. Processar
dentro do request HTTP de upload é a decisão errada mais óbvia disponível: o
atendimento manda um lote do celular, cada requisição segura uma conexão por
até 40 segundos, e no pico das 9h isso derruba o serviço antes de derrubar o
fornecedor. Então o upload responde rápido com um id e um estado, e o
processamento acontece fora do ciclo da requisição. Isso já está decidido. O
que ainda não está é *como*: fila com worker separado (BullMQ sobre Redis) ou
algo mais simples em processo. Minha inclinação é BullMQ, porque ele me dá
retry, backoff e concorrência limitada sem eu escrever nada disso, e a
concorrência limitada é o que protege o fornecedor no pico.

**O fornecedor falha.** Erro ou silêncio, de vez em quando. Preciso de timeout
explícito (nunca herdar o default do cliente HTTP), de um número finito de
tentativas com backoff, e de um estado terminal de falha que não se confunda
com "ainda processando". Finito importa porque cada tentativa é dinheiro:
retry infinito num pico é uma fatura, não uma resiliência.

O valor do timeout tem uma armadilha que eu quase caí. O reflexo é encurtar
para liberar o worker mais cedo, mas a chamada é cobrada por documento e do
lado do fornecedor: cortar aos 30 segundos uma resposta que chegaria aos 35
paga a chamada e joga fora, e o retry paga de novo. O timeout tem que ficar
acima do pior caso conhecido, em 60 segundos, e quem protege contra lentidão é
a concorrência limitada, não o relógio.

**O mesmo documento chega várias vezes.** O cliente reenvia por insegurança, o
atendimento reenvia por precaução. Cada reenvio processado é uma chamada paga
por nada. Vou detectar duplicata pelo conteúdo do arquivo (hash), antes de
chamar o modelo, e devolver o resultado que já existe. Separado disso, e não
misturado com isso, tem o retry do próprio cliente HTTP: a mesma requisição
mandada duas vezes por timeout de rede não deveria criar dois documentos. São
dois problemas diferentes (deduplicação de conteúdo e idempotência de
requisição) e eu não quero resolver os dois com o mesmo mecanismo por
preguiça.

Isso levanta uma pergunta que eu ainda não sei responder: dois arquivos com o
mesmo hash são sempre o mesmo documento de negócio? Uma foto tirada de novo do
mesmo RG tem hash diferente e é o mesmo documento. Deduplicar por hash pega o
reenvio literal, que é a maior parte do volume, e não pega a refotografia. Vou
ficar com o hash e registrar o resto como limitação conhecida.

**O arquivo não é confiável.** Nome dado pela pessoa, extensão qualquer,
content-type informado pelo cliente, foto torta direto da câmera. Nada disso
entra em decisão nenhuma: o tipo real sai da inspeção do conteúdo, o nome
original é só metadado guardado para rastreio, e o nome padronizado é gerado
por mim depois da extração. Também preciso de limite de tamanho e de recusa
explícita ao que não for imagem ou PDF, antes de gastar chamada.

**É dado pessoal, e parte é sensível.** RG, contracheque, laudo médico. Isso
muda armazenamento, log e teste. O que eu não vou fazer: logar conteúdo
extraído, nem o arquivo, nem payload de resposta do modelo em nível de info.
Nenhum documento real em lugar nenhum do repositório: os fixtures são
fictícios, gerados por mim. Retenção e criptografia em repouso eu vou
registrar como risco conhecido e não vou implementar em três dias, dizendo
isso com todas as letras.

**O volume é concentrado, não alto.** 150 por dia na média, 800 num pico de
duas horas. 800 documentos em 2 horas dá algo perto de 7 por minuto, o que é
pouco. O problema não é o número, é a duração de cada chamada: com 40 segundos
por documento e uma execução por vez, 800 documentos são mais de 8 horas de
processamento. Mas em série é a conta errada, e parar nela levaria à conclusão
errada de que não há o que fazer. Com concorrência C, o pico exige
C = 0,11 x 40 = 4,4: cinco execuções simultâneas drenam as duas horas dentro da
janela. Então o número que eu controlo é 5, e o gargalo real não é o volume nem
a duração, é o limite de chamadas do fornecedor, que eu não conheço e virou
pergunta.

Aceitar o upload rápido e deixar a fila drenar é a resposta. O custo é que o
resultado não é imediato, e o contrato precisa deixar isso explícito para quem
consome.

**O modelo e os prompts vão mudar.** Trocar de versão pelo menos uma vez, e os
prompts mais de uma vez no primeiro ano. Duas consequências. A primeira: o
núcleo não pode conhecer o fornecedor, fala com uma interface, e o dublê que
eu vou usar na fatia é uma implementação dessa interface exatamente igual às
outras, não um `if (fake)` no meio do caso de uso. A segunda, que eu acho mais
importante e menos óbvia: todo resultado precisa carregar qual modelo e qual
versão de prompt o produziram. Sem isso, quando o resultado piorar depois de
uma troca, ninguém consegue provar o que mudou.

**A conferência tem duas pessoas ao mesmo tempo.** Não vou implementar a fila
de conferência, mas o desenho precisa suportá-la: duas pessoas abrindo a
mesma fila não podem pegar o mesmo documento, e a correção de uma não pode
sobrescrever silenciosamente a da outra. Isso é um problema de concorrência
com solução conhecida, e o que eu preciso garantir agora é que o modelo de
dados não impeça a solução depois.

**Não é uma API pública.** Consumo é sistema interno, não navegador anônimo.
Autenticação real está fora da entrega por escrito, e eu vou aproveitar isso,
mas a arquitetura não pode ser desenhada como se fosse pública: a fronteira de
autenticação existe no projeto, com um mecanismo de brinquedo na
implementação, e eu digo qual seria o de verdade.

## O que eu ainda não decidi

*Atualizado depois do planejamento.* Todos os itens que estavam nesta lista
foram fechados e estão registrados: o contrato, os estados, o modelo de dados,
a política de confiança e a regra de nomenclatura na `especificacao.md`, a
estrutura de módulos e as portas na `arquitetura.md`, e as nove decisões com
alternativa descartada em `adr/`. O que ficou de fora, com o desenho de como
entraria, está em `escopo-nao-implementado.md`.

Deixo registrado o que a lista dizia, porque a lista era honesta e o percurso
faz parte da entrega: fila, banco, armazenamento dos arquivos, estados e
transições, limiar de confiança, formato do contrato e escolha dos testes.

O que continua genuinamente em aberto não depende de mim: o limite de chamadas
do fornecedor, se ele aceita chave de idempotência, se existe lista fechada de
tipos de documento e se quem consome prefere webhook a polling. Está tudo nas
perguntas abaixo.

## Perguntas que eu mandei por e-mail

O enunciado diz que perguntar conta a favor, então perguntei cedo e não no
último dia. Foram estas seis:

1. Quando o processamento termina, o sistema que consome deve ficar
   perguntando (polling) ou vocês preferem receber um aviso (webhook)? Isso
   muda o contrato, e eu não quero escolher sozinho uma coisa que é do lado de
   quem consome.
2. Existe uma lista fechada de tipos de documento que interessam, ou o tipo é
   o que o modelo disser que é? Isso muda se a extração tem um esquema por
   tipo ou um esquema aberto.
3. "Nome padronizado" tem um padrão que já existe no escritório hoje, mesmo
   informal? Se existir, eu prefiro seguir o de vocês.
4. Documento que reprova na conferência humana: o certo é corrigir os campos e
   seguir, ou existe caso de rejeitar o documento inteiro?
5. Qual o limite de chamadas por minuto do fornecedor? Eu calculei que cinco
   execuções simultâneas drenam o pico das 9h, mas se o limite dele for menor,
   o número que vale é o dele.
6. O fornecedor aceita alguma chave de idempotência na chamada? Isso decide se
   um timeout do nosso lado nos faz pagar duas vezes pelo mesmo documento.
**Uma sétima ficou de fora.** Eu tinha listado aqui a pergunta sobre HEIC: a
foto original de iPhone chega nesse formato e não em JPEG, e eu queria saber se
o fornecedor aceita ou se o serviço precisaria converter antes de enviar. Ela
não entrou no e-mail.

Resolvi por decisão em vez de reenviar: o contrato aceita `image/heic` e
`image/heif`, porque recusar o formato mais comum do público-alvo seria um
serviço que não funciona para quem ele foi feito, e a conversão ficou registrada
como risco em `escopo-nao-implementado.md`. Deixo a divergência escrita porque o
e-mail enviado é verificável e este documento dizia sete.

## Plano dos três dias

- **Dia 1:** esta análise, as decisões da lista acima com os ADRs, a
  especificação (contrato, estados, modelo de dados) e o e-mail com as
  perguntas.
- **Dia 2:** a fatia vertical implementada, com o dublê no lugar do modelo, e
  os testes que representam os riscos que eu apontei aqui.
- **Dia 3:** README, o registro do uso de IA (prompts na íntegra e em ordem, e
  onde o agente errou) e a carta de fechamento.

O enunciado diz que gastar a maior parte do tempo pensando e escrevendo é uma
escolha legítima. Estou fazendo essa escolha de propósito, e o risco dela é
chegar no dia 3 com um projeto bem argumentado e uma fatia magra demais.
Prefiro esse risco ao contrário.
