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
import type { Response } from 'express';
import { ConsultarDocumento } from '../../aplicacao/casos-de-uso/consultar-documento.caso-de-uso';
import { ReceberDocumento } from '../../aplicacao/casos-de-uso/receber-documento.caso-de-uso';
import { apresentarConsulta, apresentarRecebimento } from './apresentadores/documento.apresentador';

/**
 * A borda HTTP.
 *
 * O controller so traduz: extrai da requisicao, chama o caso de uso, monta a
 * resposta. Nao decide nada. Regra que aparecesse aqui ficaria de fora dos
 * testes que rodam com `new`, e voltaria a exigir subir contexto de framework
 * para ser verificada.
 */
@Controller('v1/documentos')
export class DocumentosController {
  constructor(
    private readonly receber: ReceberDocumento,
    private readonly consultar: ConsultarDocumento,
  ) {}

  @Post()
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
    return apresentarRecebimento(saida.documento);
  }

  @Get(':id')
  async obter(@Param('id', ParseIntPipe) id: number) {
    return apresentarConsulta(await this.consultar.executar(id));
  }
}
