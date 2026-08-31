# CLAUDE.md

Instruções para o agente que trabalha comigo neste repositório. Este arquivo é
parte da entrega e é lido pela banca: ele existe para mostrar com que grau de
controle eu conduzo o agente, então mantenha-o honesto e específico. Se uma
regra aqui deixar de valer, altere a regra em vez de contorná-la.

## O projeto

DOC Intelligence é a resposta a um desafio de seleção (`docs/desafio.md`).
Serviço interno que recebe documentos (imagem ou PDF), classifica e extrai
campos com um modelo multimodal de terceiro, guarda o resultado e permite
consultá-lo. Documentos com baixa confiança param para conferência humana.

**Escolhi a Trilha A (back-end).** Não existe front-end neste repositório.

O que é avaliado, e a distribuição da nota, está em `docs/desafio.md`. Leia
antes de propor qualquer coisa: 30% arquitetura, 20% rastreabilidade das
decisões, 20% uso de IA como ferramenta, 15% especificação e método, 15%
atenção aos fatos do ambiente. Escrever bem aqui vale mais do que implementar
mais.

## O que já está decidido

Não reabra sem eu pedir:

- Node + TypeScript + NestJS.
- O processamento **não** acontece dentro do request de upload. Upload
  responde rápido com id e estado; o modelo roda fora do ciclo da requisição.
- O núcleo não conhece o fornecedor de IA. Fala com uma interface. O dublê da
  fatia vertical é uma implementação dessa interface como qualquer outra —
  nunca um `if` de ambiente dentro do caso de uso.
- Todo resultado carrega qual modelo e qual versão de prompt o produziu.
- Deduplicação por hash do conteúdo, antes de chamar o modelo. Idempotência de
  requisição é um problema separado e tem mecanismo separado.
- Tipo do arquivo vem da inspeção do conteúdo. Nome, extensão e content-type
  informados pelo cliente são metadado, nunca entrada de decisão.

O que ainda está em aberto está listado no fim de `docs/analise-requisitos.md`.
Se você precisar de uma dessas decisões para seguir, **pare e me pergunte** —
não escolha por mim e não invente um default silencioso.

## Regras que não se quebram

1. **Nenhum dado pessoal real.** Nem em fixture, nem em teste, nem em exemplo
   de README, nem em comentário. Todo documento de teste é fictício e gerado
   para o projeto. Se você precisar de um CPF ou RG de exemplo, invente um
   inválido de propósito.
2. **Nunca logar conteúdo de documento.** Nem o arquivo, nem os campos
   extraídos, nem a resposta crua do modelo. Log carrega id, estado, duração,
   erro. Se você achar que precisa logar conteúdo para depurar, me avise em
   vez de fazer.
3. **Não implemente o que está fora da fatia.** A fatia é: receber → validar →
   persistir → enfileirar → processar (dublê) → persistir resultado →
   consultar por id. Conferência humana, listagem, autenticação real e deploy
   estão fora **por escrito**, e ficar fora é a resposta certa. Se aparecer
   uma oportunidade de incluir algo, proponha, não faça.
4. **Não escreva código antes da especificação existir.** A ordem do trabalho
   é: decidir → registrar a decisão → especificar → implementar. O desafio
   pontua essa ordem.
5. **Não instale dependência sem justificar.** Cada biblioteca nova precisa de
   uma frase dizendo o que ela resolve e o que eu escreveria à mão sem ela.

## Como escrever a documentação

Os documentos deste repositório são lidos por humanos que estão avaliando como
eu penso. Eles precisam soar como eu, não como um gerador de texto.

- Português do Brasil, primeira pessoa do singular ("decidi", "não sei
  ainda"), tom direto.
- **Registre incerteza de verdade.** Quando uma decisão tiver um lado fraco,
  escreva o lado fraco. O enunciado diz, com todas as letras, que quer ler
  sobretudo o que eu **não** fiz e por quê.
- Toda decisão relevante vem com a alternativa que eu descartei e o motivo.
  Decisão sem alternativa descartada é preferência, não decisão.
- **Evite o padrão de seção uniforme**: nove blocos com a mesma forma
  (afirmação curta, "por isso considero importante X") é a assinatura mais
  óbvia de texto gerado, e denuncia o documento inteiro. Cada assunto recebe o
  espaço que ele merece, e assuntos diferentes têm formatos diferentes.
- Sem superlativo vazio ("robusto", "escalável", "de ponta"). Prefira o
  número: "800 documentos em 2h, a 40s por chamada em série, são mais de 8h de
  processamento".
- Não reescreva um documento antigo para ele parecer que já sabia o que só
  ficou claro depois. Divergência entre o que eu planejei e o que eu fiz é
  conteúdo da entrega, não erro a esconder.

## Registro de prompts (obrigatório)

O desafio exige os prompts **na íntegra e em ordem, como foram escritos, não
reescritos depois para ficarem bonitos**.

- Vivem em `prompts/`, numerados na ordem cronológica.
- Copiados literalmente: com erro de digitação, com frase pela metade, com
  português informal. Não corrija, não melhore, não resuma.
- Quando eu esquecer de registrar um prompt, **me lembre** antes de seguir
  para a próxima tarefa.
- Se você errar e eu te corrigir, isso vale registro: anote em
  `docs/uso-de-ia.md` o que você errou, como eu percebi e o que foi feito.
  Esse parágrafo é item obrigatório da entrega e é melhor escrito no momento
  do que reconstruído de memória no último dia.

## Estrutura do repositório

```
CLAUDE.md                     este arquivo
docs/desafio.md               enunciado recebido, versionado como veio
docs/analise-requisitos.md    leitura do problema, escrita antes do código
docs/especificacao.md         contrato, estados, modelo de dados
docs/arquitetura.md           módulos, fronteiras, o que é trocável
docs/adr/                     decisões que merecem registro individual
docs/uso-de-ia.md             como conduzi o agente e onde ele errou
prompts/                      prompts na íntegra, em ordem
```

## Commits

Português, imperativo, prefixo de tipo (`docs:`, `feat:`, `test:`, `chore:`).
O corpo explica **por que**, não o que o diff já mostra.

O histórico é entregável: o enunciado pede o histórico de commits e diz
explicitamente que não quer um único commit chamado "initial". Commite cada
documento e cada passo quando ele nasce, não tudo junto no fim. Commits que
usaram o agente carregam o trailer `Co-Authored-By`, e isso é intencional: o
uso de IA aqui é obrigatório e declarado, não escondido.

## Sobre me responder

- Se eu pedir algo que contraria uma regra deste arquivo, diga qual regra e
  pergunte, em vez de obedecer calado ou recusar.
- Discorde quando tiver motivo. Este é um trabalho avaliado pelo raciocínio;
  concordância automática não me ajuda.
- Não invente API, biblioteca ou comportamento de framework. Se não tiver
  certeza, verifique ou diga que não sabe.
