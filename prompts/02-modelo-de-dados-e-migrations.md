# Sessão 02 — modelo de dados e migrations

**Data:** 31/08 · **Agente:** Claude Code (Opus 5)
**Resultado:** revisão do modelo de dados na especificação, ADR-010 e ADR-011,
atualização do ADR-006, e as migrations em SQL.

---

## Prompt 7

```
Vamos seguir para a etapa 2. Começa pelas migrations, escritas à mão em SQL, com synchronize desligado.

A nomenclatura segue o que já está na especificação: tabela e coluna em português, toda coluna com o prefixo formado pelas iniciais do nome da tabela, chave primária auto incremento e toda relação como chave estrangeira declarada no banco.

As tabelas são estas.

documento, prefixo doc_, a tabela central. Guarda doc_id auto incremento, o hash SHA-256 do conteúdo com índice único, o nome original que veio do celular, a chave de armazenamento que é o UUID gerado por nós e o único que vira caminho no disco, o tipo de mídia, o tamanho em bytes, a origem do envio, a situação, o tipo classificado, a confiança consolidada, o nome sugerido, e as datas de criação, atualização e processamento. A situação fica como varchar com CHECK nos cinco valores do ciclo de vida em vez de tabela de apoio, porque estado novo sempre exige código e a tabela só acrescentaria um join. Nome original e chave de armazenamento são colunas separadas de propósito, porque o nome vem da câmera e nunca pode virar caminho no disco.

tipo_documento, prefixo tpd_, o catálogo dos tipos. Além do código e do nome legível, guarda o template do nome padronizado e a lista de campos obrigatórios daquele tipo. Esses dois são o motivo de a tabela existir: o padrão de nomes do escritório é decisão de negócio e muda sem aviso, e é a lista de campos obrigatórios que permite exigir conferência de uma identidade sem número sem exigir o mesmo de um contrato.

campo_extraido, prefixo cae_, uma linha por campo extraído, com o valor e a confiança individual, único por documento mais nome do campo. Não use JSONB aqui, porque a regra de confiança avalia campo a campo.

processamento, prefixo pro_, uma linha por tentativa de chamada ao modelo e não por documento. Guarda o número da tentativa, provedor, modelo, versão do prompt, duração, custo estimado, se teveo dá para responder quanto o fornecedor custou no mês nem qual a taxa real de falha dele.

evento_auditoria, prefixo eva_, a trilha de acesso. Guarda a ação, o ator e um detalhe em JSONB, e esse detalhe carrega nome de campo e contagem, nunca valor extraído. A chave estrangeira para documento fica com ON DELETE SET NULL, porque o registro de que alguém acessou precisa sobreviver ao apagamento do documento.

fila_processamento, prefixo flp_, a fila em banco usada pelo adaptador Postgres. Guarda o documento, o número de tentativas, quando o item fica disponível e a reserva feita pelo worker. Cria essa tabela sempre, independente de qual adaptador de fila esteja ativo, porque migration condicional a variável de ambiente produz bancos diferentes com o mesmo número de migration.

Antes de escrever, me diga se falta mais alguma tabela.
```

**Contexto, escrito depois.** O prompt trunca no meio da descrição de
`processamento`, em "se teveo dá para responder", onde eu estava listando as
colunas de sucesso e erro. O sentido do argumento estava claro e o agente leu
certo, então não corrigi.

Perguntar "falta mais alguma tabela" antes de mandar escrever foi o que salvou
esta etapa. Eu tinha listado as tabelas de cabeça e a `submissao` passou, e com
ela iam embora o rastro dos reenvios e o lugar da chave de idempotência.

## Prompt 8

```
Faz sentido. Com a submissão separada, o nome original e a origem deixam de pertencer diretamente ao documento. Eu tinha listado as tabelas de cabeça e esse ponto passou. O fato (c) sozinho já justifica: se eu guardar apenas o primeiro envio, depois não consigo responder por quais canais aquele documento chegou, quantas vezes foi reenviado ou qual era o nome em cada submissão.

Sobre a idempotência, não quero uma chave única global. Dois sistemas internos podem gerar a mesma chave sem qualquer coordenação entre eles e um acabaria interferindo no outro. Prefiro garantir unicidade pela combinação entre o sistema que enviou e a chave de idempotência, apenas quando essa chave estiver preenchida. Para isso, a submissão também precisa identificar o sistema de origem. Essa informação já é útil para auditoria e ainda permite saber por quais canais o documento chegou.

Como o nome original passa a pertencer à submissão, também precisamos definir agora o que o GET vai devolver, para não decidir isso durante a implementação. Quero retornar o nome da submissão mais recente, além da quantidade total de submissões e dos canais pelos quais o documento chegou.

Sobre cae_origem, concordo com a proposta, mas quero registrar uma limitação. Como existe apenas um valor por documento e campo, uma eventual correção humana substituirá o valor produzido pelo modelo. Nesse caso, cae_origem passa a indicar a origem do valor atual, mas não preserva o que o modelo havia retornado antes. Para esta fatia isso é aceitável. O histórico do valor anterior e a comparação entre resposta do modelo e correção humana ficam registrados como evolução, já que seriam o que permite medir a taxa real de acerto do fornecedor.

doc_versao também entra, mesmo sem uso imediato, para deixar preparado o controle de concorrência da revisão futura. O restante está aprovado: DESCONHECIDO como entrada válida no catálogo sem campos obrigatórios, código do erro obtido pela últimsobre a fila ser condicional ao adaptador escolhido.

Acho que vale incluir no ADR-006 a consequência da tabela de submissões sobre o reenvio. O 200 deixa de representar simplesmente "já existe, não fiz nada". O documento não é processado novamente, mas uma nova submissão é registrada, e isso deixa o contrato mais fiel ao que realmente aconteceu.

Pode seguir com migrations escritas manualmente em SQL, synchronize desabilitado, prefixo das colunas pelas iniciais da tabela, chave primária auto incremento e todas as relações declaradas como chaves estrangeiras no próprio banco.

Antes de partir para o código, atualize a especificação e os ADRs com essas decisões. Depois seguimos com um commit por etapa.
```

**Contexto, escrito depois.** Este prompt também trunca, em "código do erro
obtido pela últim", e emenda com o trecho sobre a fila condicional ao adaptador.
Eu estava aprovando duas coisas: o código do erro vindo da última tentativa
registrada em `processamento`, e a correção de que a tabela de fila é criada
sempre.
