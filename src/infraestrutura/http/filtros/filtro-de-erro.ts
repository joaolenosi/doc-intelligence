import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ArquivoRecusado,
  DocumentoNaoEncontrado,
} from '../../../aplicacao/erros/erros-de-aplicacao';
import { ErroDeDominio } from '../../../dominio/comum/erro-de-dominio';
import { registrarFalha } from '../../comum/descrever-erro';

/**
 * Traduz erro de dominio e de aplicacao em resposta HTTP.
 *
 * Existe para o caso de uso nunca conhecer status code, que e o outro lado da
 * regra de o adaptador nunca deixar status code chegar no caso de uso.
 *
 * Duas coisas nunca saem daqui: conteudo de documento e detalhe interno de
 * falha tecnica. A primeira por causa do fato (d). A segunda porque stack trace
 * em resposta de erro e mapa para quem esta procurando.
 */
const POR_CODIGO: Readonly<Record<string, HttpStatus>> = {
  ARQUIVO_VAZIO: HttpStatus.BAD_REQUEST,
  TAMANHO_EXCEDIDO: HttpStatus.PAYLOAD_TOO_LARGE,
  TIPO_NAO_SUPORTADO: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
};

@Catch()
export class FiltroDeErro implements ExceptionFilter {
  catch(erro: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();

    if (erro instanceof DocumentoNaoEncontrado) {
      resposta.status(HttpStatus.NOT_FOUND).json({
        erro: 'DOCUMENTO_NAO_ENCONTRADO',
        mensagem: erro.message,
      });
      return;
    }

    if (erro instanceof ArquivoRecusado) {
      resposta.status(POR_CODIGO[erro.codigo] ?? HttpStatus.BAD_REQUEST).json({
        erro: erro.codigo,
        mensagem: erro.message,
      });
      return;
    }

    if (erro instanceof ErroDeDominio) {
      // Regra de negocio violada e erro de quem chamou, e nao falha nossa.
      resposta.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        erro: erro.codigo,
        mensagem: erro.message,
      });
      return;
    }

    if (erro instanceof HttpException) {
      const corpo = erro.getResponse();
      resposta.status(erro.getStatus()).json(
        typeof corpo === 'string' ? { erro: erro.name, mensagem: corpo } : corpo,
      );
      return;
    }

    // Falha tecnica. O log carrega o suficiente para diagnosticar, e a resposta
    // nao carrega nada. `registrarFalha` monta a saida por lista de permissao,
    // porque erro de banco traz a linha inteira em `detail` e a linha inteira e
    // dado pessoal. Fato (d) e ADR-012.
    registrarFalha('falha_interna', erro);
    resposta.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      erro: 'FALHA_INTERNA',
      mensagem: 'Nao foi possivel processar a requisicao',
    });
  }
}
