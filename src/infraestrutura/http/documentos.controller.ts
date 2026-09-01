import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ConsultarDocumento } from '../../aplicacao/casos-de-uso/consultar-documento.caso-de-uso';
import { ReceberDocumento } from '../../aplicacao/casos-de-uso/receber-documento.caso-de-uso';
import { apresentarConsulta, apresentarRecebimento } from './apresentadores/documento.apresentador';
import {
  RespostaDeConsulta,
  RespostaDeErro,
  RespostaDeRecebimento,
} from './dto/respostas.dto';

/**
 * A borda HTTP.
 *
 * O controller so traduz: extrai da requisicao, chama o caso de uso, monta a
 * resposta. Nao decide nada. Regra que aparecesse aqui ficaria de fora dos
 * testes que rodam com `new`, e voltaria a exigir subir contexto de framework
 * para ser verificada.
 */
@ApiTags('documentos')
@ApiHeader({
  name: 'X-API-Key',
  required: true,
  // O valor exibido e o padrao de desenvolvimento, que ja esta no
  // docker-compose.yml e no .env.example deste repositorio. Nao e credencial,
  // e a descricao diz o que ele e para ninguem confundir com producao.
  example: 'chave-de-desenvolvimento',
  schema: { type: 'string', default: 'chave-de-desenvolvimento' },
  description:
    'Fronteira de autenticacao entre sistemas internos, e nao seguranca de verdade. O valor preenchido aqui e o padrao do docker-compose deste projeto, entao a documentacao funciona sem configuracao nenhuma. Fora da maquina de desenvolvimento, troque a variavel API_KEY: o mecanismo real para trafego interno seria mTLS ou OAuth2 client credentials.',
})
@Controller('v1/documentos')
export class DocumentosController {
  constructor(
    private readonly receber: ReceberDocumento,
    private readonly consultar: ConsultarDocumento,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Recebe um documento',
    description: [
      'Responde na hora, sem esperar o modelo, e devolve um identificador para consulta.',
      '',
      '### Como saber que terminou',
      '',
      'O upload nao devolve o resultado: ele devolve `estado: RECEIVED`. Consulte',
      '`GET /v1/documentos/{id}` ate o estado sair de `RECEIVED` ou `PROCESSING`.',
      'Um intervalo de 2 a 5 segundos entre consultas e suficiente.',
      '',
      '### Quanto tempo leva',
      '',
      'A extracao e feita por um modelo multimodal de terceiro, que leva de 5 a 40',
      'segundos por documento e as vezes falha. Nesta entrega o modelo e um duble',
      'deterministico (`duble-deterministico-1`), entao o processamento termina em',
      'dezenas de milissegundos, mas o desenho e o mesmo: o servico espera ate 60',
      'segundos por chamada, tenta no maximo 3 vezes com espera crescente, e retenta',
      'apenas falha transitoria. Erro permanente vai direto para `FAILED`, porque',
      'repetir o que falhou por motivo deterministico so multiplica o custo.',
      '',
      'Qual modelo e qual versao de prompt produziram cada resultado aparecem no',
      '`GET`, no bloco `processamento`, junto com quantas chamadas o documento ja',
      'custou. Isso existe porque o modelo do fornecedor vai trocar de versao, e sem',
      'esse registro ninguem consegue provar o que mudou quando a extracao piorar.',
      '',
      '### Reenvio',
      '',
      '`201` no primeiro envio de um conteudo, `200` quando aquele hash ja existe. O',
      'reenvio e o comportamento esperado e nao um erro: o mesmo documento chega mais',
      'de uma vez porque o cliente reenvia por inseguranca e o atendimento reenvia por',
      'precaucao. Nesse caso o documento **nao** e reprocessado, entao nenhuma chamada',
      'nova e paga, mas a submissao e registrada e aparece em `submissoes` no `GET`,',
      'com o nome e o canal de cada envio. O corpo traz `jaExistia` para o cliente',
      'distinguir os dois casos sem depender do status code.',
      '',
      '### O que e recusado, e antes de custar qualquer coisa',
      '',
      'O tipo do arquivo sai da inspecao dos primeiros bytes, e nunca do nome, da',
      'extensao ou do content-type informado. Um `.pdf` com bytes de JPEG e um JPEG, e',
      'um executavel chamado `rg.jpeg` recebe `415`. Aceitos: JPEG, PNG, HEIC, HEIF e',
      'PDF. HEIC esta na lista porque a foto original de iPhone chega assim.',
    ].join('\n'),
  })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'X-Sistema-Origem',
    required: true,
    example: 'crm-atendimento',
    schema: { type: 'string', default: 'crm-atendimento' },
    description:
      'Qual sistema interno enviou, e por qual canal o documento chegou. Obrigatorio porque a unicidade da chave de idempotencia e do par sistema mais chave: dois sistemas internos geram identificador sem coordenacao entre si, e uma colisao acidental faria um deles ter o envio descartado em silencio. Exemplos: crm-atendimento, portal-balcao.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    example: 'req-2026-09-01-0001',
    schema: { type: 'string', default: '' },
    description:
      'Opcional. A mesma requisicao repetida por timeout de rede nao cria duas submissoes. E coisa diferente do reenvio: o reenvio do mesmo arquivo cria submissao nova de proposito, e a requisicao repetida nao. Deixe vazio para nao usar.',
  })
  @ApiBody({
    description:
      'Multipart com um unico campo. Ha arquivos ficticios prontos em `fixtures/` no repositorio, incluindo casos que devem ser recusados.',
    schema: {
      type: 'object',
      required: ['arquivo'],
      properties: {
        arquivo: {
          type: 'string',
          format: 'binary',
          description:
            'O documento, em JPEG, PNG, HEIC, HEIF ou PDF, com no maximo 25 MB. O nome do arquivo e guardado so como registro e nunca vira caminho no disco.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Primeiro envio deste conteudo. O documento foi criado em RECEIVED e o trabalho foi enfileirado. `jaExistia` vem `false`.',
    type: RespostaDeRecebimento,
  })
  @ApiOkResponse({
    description:
      'Reenvio: este conteudo ja existia. A submissao foi registrada e aparece em `submissoes` no GET, mas o documento nao foi reprocessado e nenhuma chamada nova ao modelo foi paga. `jaExistia` vem `true` e `estado` traz a situacao atual, que pode ja ser PROCESSED.',
    type: RespostaDeRecebimento,
  })
  @ApiResponse({ status: 400, description: 'Campo arquivo ausente ou header obrigatorio faltando', type: RespostaDeErro })
  @ApiResponse({ status: 401, description: 'Chave de API ausente ou invalida', type: RespostaDeErro })
  @ApiResponse({ status: 413, description: 'Arquivo acima de 25 MB', type: RespostaDeErro })
  @ApiResponse({ status: 415, description: 'Conteudo nao aceito, decidido por inspecao dos bytes', type: RespostaDeErro })
  @UseInterceptors(FileInterceptor('arquivo'))
  async enviar(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @Headers('x-sistema-origem') sistemaOrigem: string | undefined,
    @Headers('idempotency-key') chaveIdempotencia: string | undefined,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    if (arquivo === undefined) {
      throw new BadRequestException('Campo `arquivo` ausente no multipart');
    }
    if (sistemaOrigem === undefined || sistemaOrigem.trim().length === 0) {
      // Obrigatorio porque a unicidade da chave de idempotencia e por par
      // sistema mais chave. Sem ele, dois sistemas internos que gerem `req-1`
      // sem coordenacao atropelariam um ao outro. Ver ADR-006.
      throw new BadRequestException('Header `X-Sistema-Origem` e obrigatorio');
    }

    const saida = await this.receber.executar({
      conteudo: new Uint8Array(arquivo.buffer),
      // O nome vem da mao de quem enviou e e so registro. Ele nao entra em
      // decisao nenhuma e nao vira caminho no disco. Fato (b).
      nomeOriginal: arquivo.originalname,
      sistemaOrigem: sistemaOrigem.trim(),
      tipoMidiaInformado: arquivo.mimetype,
      chaveIdempotencia,
    });

    // 201 no primeiro envio, 200 quando aquele conteudo ja existe. O reenvio e
    // o comportamento esperado do fato (c), entao 409 seria mentir sobre o que
    // aconteceu. Ver ADR-006.
    resposta.status(saida.criado ? HttpStatus.CREATED : HttpStatus.OK);
    resposta.setHeader('Location', `/v1/documentos/${saida.documento.id}`);
    return apresentarRecebimento(saida.documento, !saida.criado);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta um documento',
    description:
      'O cliente consulta ate o estado sair de RECEIVED ou PROCESSING. Campos so vem preenchidos em PROCESSED e REVIEW_REQUIRED.',
  })
  @ApiOkResponse({ type: RespostaDeConsulta })
  @ApiResponse({ status: 404, description: 'Documento inexistente', type: RespostaDeErro })
  async obter(@Param('id', ParseIntPipe) id: number) {
    return apresentarConsulta(await this.consultar.executar(id));
  }
}
