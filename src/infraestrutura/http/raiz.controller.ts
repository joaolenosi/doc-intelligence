import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Configuracao } from '../config/configuracao';
import { PORTAS } from '../modulos/tokens';
import { CAMINHO_DA_DOCUMENTACAO } from './documentacao';
import { RespostaDaRaiz } from './dto/respostas.dto';
import { SemAutenticacao } from './guards/sem-autenticacao.decorator';

/**
 * Descoberta dos endpoints, no estilo da raiz da API do GitHub.
 *
 * Antes a raiz respondia 404 de proposito, para nao existir rota escondida ali.
 * O 404 resolvia esse problema e nao resolvia o outro: quem sobe o servico abre
 * a raiz, e nao ha nada dizendo para onde ir. Ver a revisao do ADR-013.
 *
 * Fica fora da fronteira de autenticacao, e isso e a segunda excecao do
 * projeto, ao lado de `healthz`. Com o guard, quem abrisse a raiz receberia 401,
 * que e pior do que 404 para o unico proposito desta rota. Ela nao devolve dado
 * de documento nenhum: sao os mesmos caminhos que qualquer um descobriria lendo
 * a documentacao.
 */
@ApiTags('descoberta')
@Controller()
@SemAutenticacao()
export class RaizController {
  constructor(@Inject(PORTAS.configuracao) private readonly configuracao: Configuracao) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os endpoints disponiveis',
    description: 'Ponto de partida. Nao exige chave de API.',
  })
  @ApiOkResponse({ type: RespostaDaRaiz })
  descobrir(@Req() requisicao: Request): RespostaDaRaiz {
    // A base sai do proprio pedido, para os links funcionarem atras de proxy,
    // em outra porta ou com outro host. Sao links de navegacao num servico
    // interno, e nao entram em decisao nenhuma do lado do servidor.
    const base = `${requisicao.protocol}://${requisicao.get('host')}`;

    return {
      servico: 'DOC Intelligence',
      versao: 'v1',
      saude: `${base}/healthz`,
      // So aparece quando esta no ar. Anunciar um caminho que responde 404
      // seria pior do que nao anunciar nada.
      documentacao: this.configuracao.documentacao.habilitada
        ? `${base}/${CAMINHO_DA_DOCUMENTACAO}`
        : null,
      // Metodo e template, e nao link absoluto. `/v1/documentos` so aceita
      // POST, entao um link cru ali daria 404 para quem clicasse, que e pior do
      // que nao anunciar. Foi conferindo os links da propria raiz que isso
      // apareceu.
      endpoints: [
        { metodo: 'POST', caminho: '/v1/documentos', descricao: 'Recebe um documento' },
        {
          metodo: 'GET',
          caminho: '/v1/documentos/{id}',
          descricao: 'Consulta o resultado de um documento',
        },
      ],
    };
  }
}
