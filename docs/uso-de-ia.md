# Uso de IA

Documento vivo, escrito conforme as coisas acontecem. O enunciado pede o
registro do uso do agente, e pede especificamente um parágrafo sobre onde ele
errou, como eu percebi e o que fiz a respeito. Reconstruir isso de memória no
último dia produziria um texto genérico, então eu anoto na hora.

## Como eu trabalhei

Claude Code, modelo Opus 5, do começo ao fim. Usei o agente para escrever a
documentação e vou usá-lo para escrever o código, sempre a partir de decisões
minhas, revisando o que voltou.

O arquivo de instruções é o `CLAUDE.md`, na raiz. Ele não é genérico: fixa o que
já está decidido para o agente não reabrir sozinho, lista as regras que não se
quebram, define o estilo de escrita dos documentos e, no ponto que eu considero
mais importante, manda o agente parar e me perguntar quando precisar de uma
decisão que ainda está em aberto, em vez de escolher um default silencioso por
mim. O `AGENTS.md` só aponta para ele, porque instrução duplicada é instrução
que diverge.

Os prompts estão em `prompts/`, na íntegra e em ordem, com os erros de digitação
preservados.

## O que eu configurei, e o que eu não configurei

O enunciado pede as skills, subagentes, comandos, hooks e servidores MCP que eu
tiver configurado, tudo versionado. **Eu não configurei nenhum**, e por isso não
existe diretório `.claude/` neste repositório. Prefiro dizer isso com todas as
letras a deixar a ausência parecer esquecimento.

O motivo é que o trabalho desta entrega é sequencial e cabe num contexto só:
ler o enunciado, decidir, especificar, implementar a fatia. Subagente serve para
paralelizar exploração ampla, e não havia o que explorar num repositório que
começou vazio. Hook serviria para automatizar uma verificação repetida, e a
verificação que importa aqui, a fronteira entre domínio e framework, vai ser um
teste do próprio projeto, que roda no `npm test` e vale para qualquer pessoa que
clonar o repositório, não só para mim rodando com agente.

Se eu fosse configurar um, seria um hook de pré-commit que recusa commit
contendo o que pareça um CPF ou RG válido, por causa do fato (d). Não fiz porque
a mesma garantia já está no `CLAUDE.md` como regra e nos fixtures gerados com
identificadores inválidos de propósito, e eu preferi não acrescentar
infraestrutura que só funciona na minha máquina.

## Onde o agente errou

**A primeira análise de requisitos era genérica.** Na sessão 00 eu pedi uma
leitura do enunciado e recebi um documento que cobria os sete fatos do ambiente,
o que estava certo, mas escrevia todos eles com a mesma forma: uma afirmação
curta, seguida de "por isso considero importante". Terminava com doze decisões
em aberto e nenhuma pergunta para o avaliador.

Percebi relendo. O texto não estava errado, estava vazio: eu não reconhecia meu
raciocínio ali, e um documento assim numa entrega que pontua rastreabilidade das
decisões seria pior do que nenhum. O que eu fiz foi mandar reescrever com as
minhas decisões, as minhas contas e as minhas dúvidas reais, e o antes e o
depois estão em `docs/versoes-anteriores/analise-requisitos-v1.md` e
`docs/analise-requisitos.md`, para quem quiser conferir a diferença em vez de
acreditar em mim.

**O agente escreveu uma afirmação falsa sobre o próprio repositório.** Ao
registrar a sessão 00, ele escreveu que o rascunho de instruções e a primeira
versão da análise estavam no commit inicial. Não estavam: ele mesmo tinha
reescrito a análise antes do primeiro commit, e o rascunho nunca chegou a ser
rastreado pelo git.

Percebi porque pedi a verificação antes de aceitar o texto, e a checagem mostrou
que os arquivos não estavam onde a frase dizia. Corrigi a frase e aproveitei
para preservar os dois artefatos em `docs/versoes-anteriores/`, o que resolveu um
problema maior: sem eles, este documento afirmaria que o agente produziu texto
genérico sem que ninguém pudesse conferir.

Anoto porque é o erro mais perigoso do conjunto. Não é um erro de código, que
quebra e aparece. É uma afirmação plausível sobre um fato verificável, escrita
com a mesma confiança do resto, e num documento que ninguém checa ela passa.

**O agente escreveu instruções sem as minhas convenções, porque eu não as tinha
dado.** O primeiro `CLAUDE.md` saiu sem arquitetura, sem convenção de banco e
sem padrão de comentário, porque nesse momento eu ainda não tinha passado o
rascunho que eu já tinha da análise prévia. Erro meu de sequência, não dele. A
correção foi fundir os dois, e nessa fusão eu recusei duas coisas do meu próprio
rascunho: os caminhos de arquivo, que apontavam para arquivos inexistentes, e a
regra de escrever mensagem de commit sem acento.

## Onde eu discordei da proposta dele

Duas vezes, e as duas viraram decisão registrada.

Ele propôs **um adaptador de fila**, com a troca de mecanismo garantida pela
porta. Recusei e pedi dois adaptadores reais, BullMQ e Postgres com
`SKIP LOCKED`, escolhidos por variável de ambiente. Adaptador que ninguém
implementou é promessa, e a pergunta que vale 30% da nota é o que acontece
quando uma peça precisa ser trocada. Está no ADR-004, com o custo de manutenção
dobrada assumido.

Ele propôs **JSONB para os campos extraídos**, com confiança agregada. Recusei
porque média esconde: um RG com três campos a 0,97 e o número a 0,40 tem média
alta e é exatamente o caso que precisa de olho humano. Pedi tabela própria, uma
linha por campo, com confiança individual. Está no ADR-007.

Nos dois casos ele tinha proposto a opção mais rápida de escrever, o que é
razoável dado o prazo, e nos dois casos a opção mais rápida abria mão do que
esta entrega mede.

## Onde ele acertou e eu não tinha visto

Registro também, porque um documento que só lista os erros do agente também
está mentindo.

Ele apontou que o comportamento 2 do produto-alvo termina em "propor um nome
padronizado para o arquivo" e que isso não estava na minha fatia. Estava certo:
era o item mais barato que fechava o comportamento central, e entrou.

Apontou que a minha conta do pico parava na metade. Eu tinha escrito que 800
documentos a 40 segundos dão mais de 8 horas em série, o que é verdade e leva a
concluir que não há o que fazer. Faltava o passo seguinte, que é dividir pela
concorrência: cinco execuções simultâneas drenam o pico dentro da janela das duas
horas.

Apontou que a foto original de iPhone chega em HEIC e não em JPEG, e que um
contrato que aceitasse só JPEG, PNG e PDF recusaria o formato mais comum de
quem o serviço atende. Não tinha me ocorrido, e virou item aceito no contrato
mais um risco registrado e uma pergunta por e-mail.

E apontou que eu tinha escrito que o fornecedor seria trocado, quando o fato (f)
diz que o modelo dele será trocado de versão. Afirmação mais forte que a fonte,
corrigida.

## Como eu verifico o que volta

Três coisas, em ordem de quanto pegam.

Comparo com o enunciado. Quase todo erro do agente até aqui foi uma afirmação
que soava certa e não estava no texto de origem, então releio o fato citado
antes de aceitar a conclusão tirada dele.

Peço a verificação antes de aceitar. Foi assim que a afirmação falsa sobre o
commit inicial apareceu: pedir para conferir onde os arquivos estavam custou uma
linha de comando e evitou uma mentira dentro da entrega.

Leio procurando forma, e não só conteúdo. Texto gerado tende a ficar uniforme, e
uniformidade é o sinal de que ninguém decidiu nada ali. É a regra que está
escrita no `CLAUDE.md`, e foi ela que fez a primeira análise ser recusada.
