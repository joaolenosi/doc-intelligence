# ADR-006: Identidade pelo hash do conteúdo, submissão separada

**Status:** aceita, 31/08/2026

## Contexto

O fato (c) diz que o mesmo documento costuma chegar mais de uma vez, porque o
cliente reenvia por insegurança e o atendimento reenvia por precaução. O fato
(b) diz que o nome do arquivo é o que a pessoa deu, e muda a cada reenvio. O
fato (a) diz que cada processamento é cobrado. Reenvio processado é dinheiro
gasto por nada.

## Decisão

A identidade do documento é o sha-256 do conteúdo do arquivo, com índice único
no banco. Cada envio cria uma linha em `submissao`, apontando para o documento,
com o nome original, o tipo de mídia informado, o sistema de origem e a data.

O nome original e o sistema de origem moram **só** na submissão. Não existe
`doc_nome_original` nem `doc_origem`. Guardá-los no documento significaria
preservar apenas o primeiro envio e perder o nome e o canal de todos os
reenvios, que é justamente a informação que o fato (c) torna interessante.

Reenvio não é erro: a API devolve `200` com o documento existente, em vez de
`409`. `201` fica só para o primeiro envio de um conteúdo.

Idempotência de requisição é problema separado, resolvido pelo header
`Idempotency-Key` gravado em `sub_chave_idempotencia`, com unicidade no par
`(sub_sistema_origem, sub_chave_idempotencia)` e só quando a chave vem
preenchida.

## Alternativas consideradas

**Deduplicar por nome do arquivo ou por metadado do envio.** Descartada de
imediato: o fato (b) diz que o nome é o que a pessoa deu, e o mesmo documento
chega como "WhatsApp Image 2026-08-11 at 09.12.33.jpeg" e "scan0001.pdf". Só o
conteúdo permanece igual.

**Uma tabela só, com uma linha por envio e a deduplicação feita na consulta.**
Mais simples de modelar. Descartada porque a garantia de não pagar duas vezes
passaria a depender de a aplicação lembrar de consultar antes, em vez de ser
imposta pelo banco. Com índice único, duas requisições simultâneas do mesmo
arquivo não conseguem criar dois documentos nem em condição de corrida.

**Uma tabela só, guardando apenas o primeiro envio e descartando os demais.**
Resolve o custo e é a opção mais barata. Descartada porque joga fora informação
de negócio: o escritório perde a capacidade de saber que aquele documento chegou
três vezes e por quais canais, que é exatamente o comportamento que o cenário
descreve. Separar submissão de documento dá isso de graça.

**Tratar o reenvio como conflito, respondendo `409`.** Descartada porque seria
mentir sobre o que aconteceu. O reenvio é o comportamento esperado do fato (c),
não um erro do cliente, e forçar quem consome a tratar exceção para um caso
normal é contrato ruim.

**Chave de idempotência única global.** Seria o índice mais simples de escrever.
Descartada porque dois sistemas internos geram identificador sem nenhuma
coordenação entre si, e nada impede que os dois usem `1`, `req-1` ou o mesmo
UUID de uma biblioteca mal semeada. Numa colisão acidental, o segundo sistema
teria o envio descartado em silêncio, e o sintoma seria um documento que
simplesmente não chegou, sem erro em lugar nenhum. Escopar por sistema custa uma
coluna no índice e elimina a classe inteira de problema. É também o que torna
`X-Sistema-Origem` obrigatório e não opcional.

## Consequências

**O `200` deixa de significar "já existe, não fiz nada".** Ele passa a
significar que o documento não foi processado de novo, mas que uma submissão
nova foi registrada. É uma resposta mais fiel ao que de fato aconteceu, e o
contrato precisa dizer isso, porque um cliente que leia `200` como "ignorado"
vai concluir errado que o envio dele não deixou rastro.

Como o nome original passa a pertencer à submissão, o `GET` precisa decidir o
que devolver, e a decisão é agora e não durante a implementação: nome da
submissão mais recente, total de submissões e a lista de canais por onde o
documento chegou. Está no bloco `submissoes` da especificação.

Uma junção a mais para responder "quantas vezes esse documento chegou", o que é
irrelevante neste volume.

O hash é calculado no caminho do upload, sobre até 25 MB. É custo de CPU no
request, mas é muito mais barato do que uma chamada ao modelo.

**Limitação conhecida.** O hash pega o reenvio literal do mesmo arquivo, que é a
maior parte do volume descrito. Não pega refotografia: o cliente que tira outra
foto do mesmo RG gera bytes diferentes e cria um documento novo, que vai ser
processado e cobrado. Resolver isso exigiria comparação perceptual de imagem ou
deduplicação pelos campos já extraídos, e as duas coisas custam mais do que a
economia que trazem neste volume. Está registrado em
`docs/escopo-nao-implementado.md`.
