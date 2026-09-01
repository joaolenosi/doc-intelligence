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
tiver configurado, tudo versionado.

**Um servidor MCP:** o do Playwright, em `.mcp.json`, na raiz. Ele entrou
quando eu quis testes que batessem na API pela rede, contra o ambiente do
`docker compose`, em vez de subir o Nest dentro do Jest.

Sobre ele eu preciso ser honesto quanto ao alcance: a Trilha A não tem
interface, então a automação de navegador, que é o que o MCP do Playwright
oferece de específico, **não foi exercitada**. O que este projeto usa é o
executor de testes de API do Playwright, e isso não depende do MCP. Deixei o
servidor configurado e versionado porque o enunciado pede o registro do que foi
configurado, e não porque ele carregou o trabalho.

**Nenhuma skill, nenhum subagente, nenhum comando e nenhum hook**, e não existe
diretório `.claude/` neste repositório. Prefiro dizer isso com todas as letras a
deixar a ausência parecer esquecimento.

O motivo é que o trabalho desta entrega é sequencial e cabe num contexto só:
ler o enunciado, decidir, especificar, implementar a fatia. Subagente serve para
paralelizar exploração ampla, e não havia o que explorar num repositório que
começou vazio. Hook serviria para automatizar uma verificação repetida, e as
verificações que importam aqui, a fronteira entre domínio e framework e a
fronteira de autenticação, viraram testes do próprio projeto, que rodam no
`npm test` e valem para qualquer pessoa que clonar o repositório, não só para
mim rodando com agente.

Se eu fosse configurar um hook, seria um de pré-commit recusando commit que
contenha o que pareça um CPF ou RG válido, por causa do fato (d). Não fiz porque
a mesma garantia já está no `CLAUDE.md` como regra e nos fixtures com
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

**O agente parou de registrar os meus prompts e eu tive que cobrar.** O
`CLAUDE.md` tem uma regra explícita mandando ele me lembrar de registrar o
prompt antes de seguir para a próxima tarefa. Nos prompts 9 e 10 ele foi direto
para o trabalho, e os dois ficaram fora de `prompts/` até eu perceber e cobrar.

Percebi porque o registro é item obrigatório da entrega e eu estava conferindo
o que já existia. O conserto foi registrar os dois com o texto original, mais
este parágrafo.

E precisei cobrar de novo, na etapa do contrato OpenAPI. As duas vezes o agente
estava no meio de um problema técnico absorvente, perseguindo teste
intermitente. O padrão é claro o suficiente para eu escrever: a disciplina de
registro é a primeira coisa que cai quando a tarefa fica interessante, e é
exatamente por isso que ela precisa estar escrita como regra em vez de contar
com atenção.

O que isso ensina sobre conduzir agente é o que me interessa aqui: a regra
estava escrita, estava no arquivo que ele lê, e mesmo assim ela decaiu conforme
a conversa ficou longa e as tarefas técnicas foram ficando mais interessantes
que a disciplina de registro. Instrução escrita não é garantia de instrução
seguida, e a parte que não pode ser delegada é justamente a conferência.

**O agente afirmou que estava pronto sem ter rodado, e quebrou a regra que o
`CLAUDE.md` chama de pior erro possível.** No commit da camada HTTP ele rodou a
suíte, filtrou a saída para ver só o resumo, e empurrou o commit sem olhar que
dois testes de integração estavam vermelhos. O arquivo de instruções diz, com
essas palavras, que relatar sucesso sem ter verificado é o pior erro possível
naquele repositório, porque contamina todas as decisões seguintes.

Percebi na linha seguinte, quando a saída completa apareceu. O conserto foi
imediato, mas o commit ruim já estava no remoto, e eu preferi deixá-lo lá com o
conserto num commit próprio a reescrever o histórico: o enunciado quer ler como
o trabalho aconteceu, e um histórico limpo demais esconde justamente isso.

**E aconteceu de novo, uma etapa depois.** No commit dos testes ponta a ponta,
o agente rodou a suíte de ponta a ponta, viu 14 verdes e empurrou, sem rodar o
`npm test`. Os arquivos novos terminavam em `.spec.ts` e passaram a ser
capturados pelo Jest, que tentou carregá-los e quebrou: a suíte de unidade ficou
vermelha por duas etapas sem ninguém perceber.

Anoto separado do caso anterior de propósito, porque a repetição é o dado. O
primeiro caso podia ser distração; o segundo mostra que a regra escrita no
`CLAUDE.md` não estava sendo executada de fato, só citada. A correção foi
excluir os arquivos de ponta a ponta do Jest, e a correção de verdade é que
"rodei a suíte" precisa significar as três suítes, e não a que eu acabei de
escrever.

**O diagnóstico vale mais do que o erro.** Os dois testes falhavam de forma
intermitente: passavam quando eu rodava o arquivo sozinho e falhavam na suíte
inteira. A leitura fácil seria "teste instável", que é o rótulo que faz um
problema real ser ignorado por meses.

Não era instabilidade. Os testes de integração usavam o mesmo banco do
`docker compose`, e o ambiente estava de pé com `FILA_ADAPTADOR=postgres`. O
worker do compose consome a tabela `fila_processamento`, então ele estava
literalmente roubando as linhas que o teste tinha acabado de inserir, entre o
`INSERT` do teste e o `SELECT` da verificação. Concorrência de verdade, entre
dois processos que ninguém tinha pensado como concorrentes.

A correção foi dar aos testes um banco próprio, criado automaticamente. O que
eu levo disso é sobre o rótulo: "flaky" é uma explicação que dispensa
investigação, e foi preciso resistir a ela para achar uma condição de corrida
que existiria igual em produção, com dois workers e um script de manutenção.

**O agente escreveu instruções sem as minhas convenções, porque eu não as tinha
dado.** O primeiro `CLAUDE.md` saiu sem arquitetura, sem convenção de banco e
sem padrão de comentário, porque nesse momento eu ainda não tinha passado o
rascunho que eu já tinha da análise prévia. Erro meu de sequência, não dele. A
correção foi fundir os dois, e nessa fusão eu recusei duas coisas do meu próprio
rascunho: os caminhos de arquivo, que apontavam para arquivos inexistentes, e a
regra de escrever mensagem de commit sem acento.

**O agente escreveu um bug de relógio, e a intermitência foi o sintoma certo.**
O adaptador de fila em Postgres gravava `flp_disponivel_em` com o relógio da
aplicação, e o consumo comparava com `NOW()` do banco. Dois relógios. Com o
processo alguns milissegundos à frente do container, o trabalho nascia
indisponível e só era pego no ciclo seguinte.

Percebi porque dois testes falhavam em cerca de uma execução em três, e eu já
tinha decidido, no caso anterior, não aceitar "flaky" como explicação. Rodei o
arquivo isolado seis vezes para separar interferência entre suítes de corrida
interna, e a corrida era interna.

O conserto foi fazer o banco carimbar as datas da fila, com `DEFAULT NOW()`, de
modo que uma fonte de tempo só responda pela disponibilidade. Oito execuções
seguidas limpas depois disso.

Atrás dele apareceu ainda um terceiro caso, do lado do Redis: o teste da fila
BullMQ publicava na mesma fila que o worker do compose consumia, e a contagem
dava zero em metade das execuções. É a repetição exata do problema do banco
compartilhado, e a lição vale para os dois lados: teste de integração que
divide infraestrutura com o ambiente em execução não está medindo o próprio
código, está disputando com outro processo. Passou a usar uma fila própria. O resto do sistema continua usando o relógio da
aplicação, e a diferença está registrada em `escopo-nao-implementado.md`, porque
ela não muda comportamento hoje mas voltaria a morder numa consulta que misture
as duas fontes.

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
