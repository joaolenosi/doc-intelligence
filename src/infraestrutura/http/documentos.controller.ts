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
    'Fronteira de autenticacao entre sistemas internos, e nao seguranca de verdade. O valor preenchido e o padrao do docker-compose deste projeto; fora dele, troque a variavel API_KEY.',
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
      'Responde na hora e devolve um identificador. O resultado nao vem aqui:',
      'consulte `GET /v1/documentos/{id}` ate o estado sair de `RECEIVED` ou',
      '`PROCESSING`, a cada 2 a 5 segundos.',
      '',
      '- `201` no primeiro envio de um conteudo, `200` quando aquele hash ja existe.',
      '  O reenvio nao reprocessa e nao paga chamada nova, mas registra a submissao.',
      '  O corpo traz `jaExistia` para distinguir os dois sem olhar o status code.',
      '- O tipo sai dos bytes, e nunca do nome ou do `Content-Type`. Aceita JPEG,',
      '  PNG, HEIC, HEIF e PDF, ate 25 MB.',
      '',
      'Tempo de processamento, retentativa e custo estao em `docs/especificacao.md`.',
    ].join('\n'),
  })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'X-Sistema-Origem',
    required: true,
    example: 'crm-atendimento',
    schema: { type: 'string', default: 'crm-atendimento' },
    description:
      'Qual sistema interno enviou, e por qual canal o documento chegou. Obrigatorio porque a unicidade da chave de idempotencia e do par sistema mais chave. Exemplos: crm-atendimento, portal-balcao.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    example: 'req-2026-09-01-0001',
    schema: { type: 'string', default: '' },
    description:
      'Opcional. Requisicao repetida por timeout de rede nao cria submissao nova. E diferente do reenvio do mesmo arquivo, que cria. Deixe vazio para nao usar.',
  })
  @ApiBody({
    description: 'Ha arquivos ficticios prontos em `fixtures/`, incluindo casos recusados.',
    schema: {
      type: 'object',
      required: ['arquivo'],
      properties: {
        arquivo: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG, HEIC, HEIF ou PDF, ate 25 MB.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Primeiro envio deste conteudo. `jaExistia` vem `false`.',
    type: RespostaDeRecebimento,
  })
  @ApiOkResponse({
    description:
      'Reenvio: o conteudo ja existia. Submissao registrada, documento nao reprocessado. `jaExistia` vem `true` e `estado` traz a situacao atual.',
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
      'Consulte ate o estado sair de `RECEIVED` ou `PROCESSING`. Campos so vem preenchidos em `PROCESSED` e `REVIEW_REQUIRED`.',
  })
  @ApiOkResponse({ type: RespostaDeConsulta })
  @ApiResponse({ status: 404, description: 'Documento inexistente', type: RespostaDeErro })
  async obter(@Param('id', ParseIntPipe) id: number) {
    return apresentarConsulta(await this.consultar.executar(id));
  }
}
