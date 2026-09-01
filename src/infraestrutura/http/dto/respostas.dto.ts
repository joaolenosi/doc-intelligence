import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SituacaoDocumento } from '../../../dominio/documento/situacao-documento';

/**
 * As formas de resposta, para o contrato ser gerado a partir do codigo.
 *
 * Elas existem so para descrever o contrato: quem monta a resposta continua
 * sendo o apresentador. Isso cria uma duplicacao possivel, e por isso existe um
 * teste que compara as chaves da resposta real com as chaves documentadas aqui.
 * Sem esse teste, o contrato divergiria da resposta na terceira alteracao, que e
 * o mesmo motivo de ele ser gerado e nao escrito a mao.
 *
 * Todo exemplo e ficticio, incluindo o nome sugerido, que e montado a partir dos
 * campos extraidos e por isso cai na mesma regra do fato (d). Os numeros de
 * documento reprovam em qualquer validacao de digito, de proposito.
 */

export class RespostaDeRecebimento {
  @ApiProperty({ example: 42, description: 'Identificador do documento' })
  id!: number;

  @ApiProperty({
    enum: SituacaoDocumento,
    example: SituacaoDocumento.RECEIVED,
    description:
      'Situacao no momento da resposta. O upload nao espera o modelo, entao aqui e sempre RECEIVED no primeiro envio.',
  })
  estado!: string;

  @ApiProperty({
    example: 'c2f0a4d1b8e6539a7c41d0b2e8f36a91d4c7b05e29a1f83b6d0c4e7a95b2f318',
    description: 'sha-256 do conteudo. E a identidade do documento.',
  })
  hashConteudo!: string;

  @ApiProperty({ example: 'image/jpeg', description: 'Detectado por inspecao dos bytes, nunca o informado.' })
  tipoMidia!: string;

  @ApiProperty({ example: 2481003 })
  tamanhoBytes!: number;

  @ApiProperty({
    example: false,
    description:
      'Falso no primeiro envio deste conteudo, verdadeiro quando ele ja existia. Sem este campo, primeiro envio e reenvio so se distinguiriam pelo status code, e quem le apenas o corpo nao saberia qual dos dois aconteceu.',
  })
  jaExistia!: boolean;

  @ApiProperty({ example: '2026-09-01T12:04:11.221Z' })
  criadoEm!: string;
}

export class CampoDaResposta {
  @ApiProperty({ example: 'nome' })
  nome!: string;

  @ApiProperty({ example: 'MARIA FICTICIA DE SOUZA', description: 'Dado pessoal. Nunca aparece em log.' })
  valor!: string;

  @ApiProperty({ example: 0.96, minimum: 0, maximum: 1, description: 'Confianca daquele valor, e nao do documento.' })
  confianca!: number;

  @ApiProperty({ example: 'MODELO', enum: ['MODELO', 'CORRECAO_HUMANA'] })
  origem!: string;
}

export class SubmissoesDaResposta {
  @ApiProperty({ example: 2, description: 'Quantas vezes esse conteudo chegou.' })
  total!: number;

  @ApiProperty({
    example: ['crm-atendimento', 'portal-balcao'],
    description: 'Sistemas por onde o documento chegou, sem repeticao.',
    type: [String],
  })
  canais!: string[];

  @ApiProperty({ example: 'procuracao-registro-casa.pdf' })
  nomeOriginalMaisRecente!: string;
}

export class ErroDoProcessamento {
  @ApiProperty({ example: 'TIMEOUT' })
  codigo!: string;

  @ApiPropertyOptional({ example: 'Extrator nao respondeu em 60000ms', description: 'Tecnica. Nunca conteudo do documento.' })
  mensagem?: string;
}

export class ProcessamentoDaResposta {
  @ApiProperty({ example: 1, description: 'Quantas chamadas ao modelo esse documento ja custou.' })
  tentativas!: number;

  @ApiPropertyOptional({ example: 'duble', nullable: true })
  provedor?: string | null;

  @ApiPropertyOptional({ example: 'duble-deterministico-1', nullable: true })
  modelo?: string | null;

  @ApiPropertyOptional({
    example: 'extracao-rg.v1',
    nullable: true,
    description: 'Qual versao de prompt produziu o resultado. Serve para comparar depois de uma troca de modelo.',
  })
  versaoPrompt?: string | null;

  @ApiPropertyOptional({ type: ErroDoProcessamento, nullable: true })
  erro?: ErroDoProcessamento | null;
}

export class RespostaDeConsulta {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ enum: SituacaoDocumento, example: SituacaoDocumento.PROCESSED })
  estado!: string;

  @ApiPropertyOptional({ example: 'RG', nullable: true })
  tipoDocumento?: string | null;

  @ApiPropertyOptional({ example: 0.94, nullable: true, minimum: 0, maximum: 1 })
  confiancaTipo?: number | null;

  @ApiPropertyOptional({
    // Ficticio, com identificador que reprova em validacao de digito. O nome
    // sugerido carrega nome de pessoa e numero de documento, entao ele cai na
    // mesma regra dos arquivos de teste. Ver ADR-012.
    example: 'RG_MARIA_FICTICIA_DE_SOUZA_000000000_2026-09-01.jpg',
    nullable: true,
    description:
      'Proposta de nome. O servico nao renomeia nada: no disco o arquivo continua guardado pela chave de armazenamento.',
  })
  nomePadronizado?: string | null;

  @ApiProperty({
    type: [String],
    example: ['CONFIANCA_CAMPO_BAIXA:numero'],
    description:
      'Por que o documento parou para conferencia. Codigos e nomes de campo, nunca valores. Vazio quando o estado nao e REVIEW_REQUIRED.',
  })
  motivosRevisao!: string[];

  @ApiProperty({
    type: [CampoDaResposta],
    description: 'So vem preenchido em PROCESSED e REVIEW_REQUIRED.',
  })
  campos!: CampoDaResposta[];

  @ApiProperty({ type: SubmissoesDaResposta })
  submissoes!: SubmissoesDaResposta;

  @ApiProperty({ type: ProcessamentoDaResposta })
  processamento!: ProcessamentoDaResposta;

  @ApiProperty({ example: '2026-09-01T12:04:11.221Z' })
  criadoEm!: string;

  @ApiPropertyOptional({ example: '2026-09-01T12:04:29.884Z', nullable: true })
  processadoEm?: string | null;
}

export class RespostaDeErro {
  @ApiProperty({ example: 'TIPO_NAO_SUPORTADO' })
  erro!: string;

  @ApiProperty({ example: 'Conteudo nao e JPEG, PNG, HEIC nem PDF' })
  mensagem!: string;
}

export class RespostaDeSaude {
  @ApiProperty({ example: 'ok' })
  estado!: string;

  @ApiProperty({ example: 'ok' })
  banco!: string;
}

export class EndpointDaRaiz {
  @ApiProperty({ example: 'POST' })
  metodo!: string;

  @ApiProperty({ example: '/v1/documentos' })
  caminho!: string;

  @ApiProperty({ example: 'Recebe um documento' })
  descricao!: string;
}

export class RespostaDaRaiz {
  @ApiProperty({ example: 'DOC Intelligence' })
  servico!: string;

  @ApiProperty({ example: 'v1' })
  versao!: string;

  @ApiProperty({
    example: 'http://localhost:3000/healthz',
    description: 'Link absoluto, para colar no navegador.',
  })
  saude!: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/v1/docs',
    nullable: true,
    description: 'Nulo quando DOCS_HABILITADO esta desligado, para nao anunciar um caminho que responde 404.',
  })
  documentacao!: string | null;

  @ApiProperty({
    type: [EndpointDaRaiz],
    description:
      'As operacoes da API, com metodo e template. Nao sao links absolutos de proposito: /v1/documentos so aceita POST, e anunciar a URL crua faria quem clicasse receber 404.',
  })
  endpoints!: EndpointDaRaiz[];
}
