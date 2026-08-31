# O que ficou de fora

O enunciado diz que quer ler sobretudo o que eu não fiz, e que tratar um fato do
ambiente pode ser resolvê-lo ou apenas registrá-lo como risco conhecido,
explicando por que ficou para depois. Este é o documento dessa segunda parte.

Cada item diz o que é, por que ficou fora, o que quebra se alguém ignorar, e
como entraria. A ordem é por consequência, não por esforço.

## O produto-alvo, item a item

| Comportamento | Situação |
|---|---|
| 1. Receber imagem ou PDF de aplicação cliente | implementado |
| 2. Descobrir o tipo, extrair campos, propor nome padronizado | implementado, com dublê no lugar do modelo |
| 3. Consultar o resultado de um documento | implementado |
| 3. Listar os já processados | **não implementado** |
| 4. Baixa confiança não entra como pronto | implementado até `REVIEW_REQUIRED` |
| 4. A pessoa conferente corrige o que a máquina errou | **não implementado** |
| 5. Consumido por sistemas internos, não por navegador anônimo | fronteira implementada, autenticação real não |

## Riscos aceitos

### A janela entre gravar o documento e publicar o trabalho

Com o adaptador BullMQ, o estado do documento fica no Postgres e o job fica no
Redis. São dois sistemas, e não existe transação entre eles. Se o processo cair
entre gravar o documento e publicar o trabalho, o documento fica parado em
`RECEIVED` esperando um worker que nunca vai pegá-lo. Ele não some, não dá erro
e não aparece em lugar nenhum: fica simplesmente parado, que é a pior forma de
falhar.

Ficou fora porque a fatia entrega o caminho feliz e o caminho de falha do
fornecedor, e essa é uma falha do nosso lado, mais rara. Com o adaptador de
Postgres ligado, a janela não existe, porque gravar o documento e criar o
trabalho cabem na mesma transação.

**Como entraria.** Uma rotina periódica que busca documentos em `RECEIVED` com
`doc_criado_em` mais velho que alguns minutos e republica o trabalho, apoiada no
índice `(doc_estado, doc_criado_em)` que já existe. Republicar é seguro porque o
processamento já é guardado pelo estado: um documento que saiu de `RECEIVED` não
volta. A alternativa mais robusta seria o padrão outbox, gravando a intenção de
publicar na mesma transação do documento e deixando um processo separado
publicar, o que fecha a janela sem depender de varredura.

### Cobrança duplicada quando o timeout não cancela o processamento do fornecedor

Nosso timeout é de 60 segundos. Se o fornecedor responder aos 65, nós já
desistimos, pagamos por aquela chamada, descartamos a resposta, e o retry paga
outra vez. No limite, um documento custa 3 chamadas e não aproveita nenhuma.

Ficou fora porque fechar isso depende do fornecedor, não de nós: seria preciso
que ele aceitasse uma chave de idempotência de requisição e devolvesse o
resultado já computado em vez de recomputar. Eu não sei se o fornecedor real
oferece isso, e virou pergunta por e-mail.

**Como entraria.** Chave de idempotência derivada do hash do documento e da
versão do prompt, enviada em cada chamada, com o adaptador tratando a resposta
repetida como resultado válido. Enquanto isso não existir, o mitigador barato é
observar quantas chamadas cada documento consumiu, que é o que `doc_tentativas`
já registra.

### Dado pessoal: cifragem em repouso e política de retenção

O fato (d) diz que o conteúdo é dado pessoal e parte dele é sensível. O que está
implementado é a higiene: log sem conteúdo, com teste que verifica isso, campo
extraído concentrado numa tabela só, arquivo gravado pelo hash fora do controle
de versão, e nenhum documento real em lugar nenhum.

O que não está: cifragem em repouso do arquivo e da coluna `cae_valor`, política
de retenção com descarte automático, registro de quem acessou qual documento, e
o tratamento formal de LGPD que um escritório de advocacia precisa ter, com base
legal e prazo definidos.

Ficou fora porque nenhuma dessas coisas é decisão técnica isolada: retenção e
base legal são decisão do escritório, e implementar um prazo que eu inventei
seria pior do que não implementar. Cifragem em repouso é técnica, mas sem a
decisão de retenção ela protege um dado que talvez nem devesse continuar
existindo.

**Como entraria.** Retenção como coluna de expiração no documento, preenchida
por política por tipo, com uma rotina que apaga arquivo e campos extraídos e
mantém o registro do documento para auditoria. Cifragem no armazenamento, atrás
da porta `ArmazenamentoDeArquivo`, que é exatamente o tipo de troca que a
arquitetura torna barata. Acesso registrado em `evento_auditoria`, que já
existe.

### A fila de conferência humana

O comportamento 4 termina em "a pessoa conferente corrige o que a máquina
errou", e o fato (g) diz que duas pessoas do atendimento podem abrir a fila ao
mesmo tempo. Nada disso está implementado.

O que está é o desenho: o estado `REVIEW_REQUIRED` existe e é devolvido no
contrato, `cae_origem` distingue `MODELO` de `CORRECAO_HUMANA`, e `doc_versao`
está na tabela para lock otimista.

**Como entraria.** Uma rota que entrega o próximo documento da fila usando
`SELECT ... FOR UPDATE SKIP LOCKED`, que é o mesmo mecanismo já implementado no
adaptador de fila do Postgres, de modo que duas pessoas nunca peguem o mesmo
documento. O estado `IN_REVIEW` entre `REVIEW_REQUIRED` e `PROCESSED`, com prazo
de posse para o documento voltar à fila se a pessoa fechar o navegador. A
correção grava novas linhas em `campo_extraido` com origem `CORRECAO_HUMANA` e
incrementa `doc_versao`, e a gravação falha se a versão mudou, que é o que
impede uma correção de sobrescrever a outra em silêncio.

A coluna `doc_versao` não é usada nesta fatia. Ela está lá porque adicionar
controle de concorrência depois, numa tabela com dados, é caro, e uma coluna
vazia agora é barata.

### Listagem dos documentos processados

Metade do comportamento 3 do produto. Não implementada.

Ficou fora por escolha de escopo: o enunciado diz que uma fatia estreita e
honesta vale mais do que cinco funcionalidades pela metade, e eu preferi gastar
o tempo na consulta por identificador funcionando de ponta a ponta. É o item
mais barato desta lista e o primeiro que eu faria a seguir.

**Como entraria.** `GET /v1/documentos` com paginação por cursor sobre
`doc_criado_em`, filtro por estado apoiado no índice
`(doc_estado, doc_criado_em)` que já existe, e a regra de nunca devolver valor
de campo extraído em listagem, por causa do fato (d): listagem devolve
identificador, estado, tipo e nome padronizado, e quem quiser o conteúdo consulta
o documento específico.

### HEIC e orientação por EXIF

O fato (b) diz que a foto vem original da câmera. Foto original de iPhone é
HEIC, não JPEG, e foto de celular carrega orientação em EXIF que muitos leitores
ignoram, entregando a imagem deitada.

O contrato aceita `image/heic` e `image/heif`, porque recusar o formato mais
comum do público-alvo seria um serviço que não funciona para quem ele foi feito.
O que não está implementado é a conversão para um formato que o modelo aceite e
a rotação segundo o EXIF.

Ficou fora porque depende do que o fornecedor real aceita, que eu não sei, e
porque conversão de imagem traz dependência nativa que complica a subida do
projeto, indo contra o requisito de README que permita a outra pessoa rodar.

**O que quebra.** Se o fornecedor não aceitar HEIC, todo documento vindo de
iPhone falha na chamada, e como é falha permanente ele vai direto para `FAILED`
sem retry, que ao menos evita pagar três vezes. Se a orientação não for
corrigida, a extração piora em silêncio, que é pior: o documento entra como
processado com campos errados e confiança possivelmente alta.

**Como entraria.** Normalização no adaptador de entrada, antes de chamar o
extrator, convertendo HEIC para JPEG e aplicando a rotação do EXIF. É trabalho
de infraestrutura e não encosta no domínio.

### Refotografia do mesmo documento

A deduplicação do ADR-006 é por hash do conteúdo, então pega o reenvio literal do
mesmo arquivo, que é a maior parte do que o fato (c) descreve. Não pega o cliente
que tira outra foto do mesmo RG: bytes diferentes, documento novo, chamada paga.

Ficou fora porque resolver exigiria comparação perceptual de imagem ou
deduplicação pelos campos já extraídos, e as duas custam mais do que economizam
neste volume. A segunda, aliás, só funciona depois de pagar a extração, que é
justamente o custo que se queria evitar.

**Como entraria.** Depois da extração, procurar documento já processado do mesmo
tipo com os mesmos campos identificadores, por exemplo número do RG, e marcar
como possível duplicata para conferência humana em vez de decidir sozinho.

### Rate limit do fornecedor

A concorrência foi calculada a partir do volume: 800 documentos em 2 horas dão
0,11 por segundo, que a 40 segundos de pior caso exigem cerca de 4,4 execuções
simultâneas, arredondadas para 5. O que essa conta não sabe é qual o limite de
chamadas do fornecedor.

Se o limite for menor que 5, o pico não drena na janela e a fila cresce, o que é
degradação aceitável. Se o fornecedor responder `429`, o adaptador trata como
falha transitória e retenta, o que funciona mas consome tentativas do teto.

**Como entraria.** Tratar `429` como classe própria, com backoff a partir do
`Retry-After` e sem consumir o teto de tentativas, mais um limitador de taxa no
adaptador. Virou pergunta por e-mail, porque o número é do fornecedor.

### Object storage no lugar do disco

O arquivo é gravado em disco local. No pico, 800 fotos de até 25 MB são vários
gigabytes por dia, e disco local não sobrevive a mais de uma instância nem a um
container efêmero.

Ficou fora porque MinIO ou S3 acrescentam infraestrutura sem acrescentar
demonstração: a porta `ArmazenamentoDeArquivo` já existe, e trocar o adaptador é
o exemplo mais simples de troca de peça do projeto inteiro.

**Como entraria.** Um adaptador da mesma porta. O caminho gravado em
`doc_caminho_armazenamento` já é opaco para o domínio, então nada além do
adaptador muda.

### Autenticação real

Existe uma chave estática comparada em tempo constante, declarada como fronteira
e não como segurança. O enunciado dispensa autenticação real.

**Como entraria.** Para tráfego entre sistemas internos, mTLS ou OAuth2 client
credentials com escopo por cliente. O guard já é o ponto único onde isso entra.

### Observabilidade e custo por documento

Não há métrica, tracing nem painel. O que existe é log estruturado e
`doc_tentativas`, que responde quanto cada documento custou em chamadas.

Ficou fora por prazo. Num serviço cobrado por chamada, a métrica que importa não
é latência, é chamadas por documento processado: se essa razão subir, alguém
está pagando duas vezes pela mesma coisa e ninguém percebe.

**Como entraria.** Contador de chamadas ao extrator por resultado, histograma de
duração, e alerta sobre a razão entre chamadas e documentos concluídos.

### Fila de descarte e reprocessamento manual

Documento em `FAILED` fica em `FAILED`. Não existe rota para reprocessar, nem
fila de descarte para inspecionar o que falhou.

Ficou fora porque reprocessar é decisão humana com custo, e uma rota de
reprocessamento sem conferência humana permite gastar dinheiro em massa por
engano.

**Como entraria.** Uma rota administrativa que republica o trabalho de um
documento em `FAILED`, zerando o contador de tentativas, com registro em
`evento_auditoria` de quem pediu. Naturalmente depois da fila de conferência,
que é onde uma pessoa olharia o caso antes de decidir.

### PDF de múltiplas páginas

O PDF é enviado inteiro ao extrator, sem separar páginas. Um scan de várias
páginas com documentos diferentes vira um documento só, com um tipo só. Não sei,
sem dados reais, com que frequência isso acontece, e por isso não implementei uma
solução para um problema cujo tamanho eu desconheço.

**Como entraria.** Separação em páginas antes da extração, com cada página
virando um documento próprio ligado ao envio original, o que a tabela `submissao`
já comporta.
