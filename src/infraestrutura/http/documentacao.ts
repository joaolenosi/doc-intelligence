import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Monta o contrato OpenAPI a partir da propria aplicacao.
 *
 * O mesmo documento serve a rota de documentacao e ao script que grava
 * `docs/contrato-openapi.json`. Sao dois consumidores da mesma fonte de
 * proposito: contrato escrito a mao diverge do codigo na terceira alteracao.
 */

/** Fixo, e nao na raiz. A raiz continua em 404, sem rota e sem redirecionamento. */
export const CAMINHO_DA_DOCUMENTACAO = 'v1/docs';

export function montarContrato(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('DOC Intelligence')
    .setDescription(
      [
        'Servico interno que recebe imagem ou PDF, classifica, extrai os campos do tipo',
        'e propoe um nome padronizado. O upload responde na hora e o resultado sai na',
        'consulta.',
        '',
        'Todo exemplo aqui e ficticio e nenhum numero passa em validacao de digito.',
        '',
        'Projeto, decisoes e o que ficou de fora estao em `docs/` no repositorio.',
      ].join('\n'),
    )
    .setVersion('1')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description:
          'Fronteira de autenticacao entre sistemas internos. Nao e seguranca de verdade: o mecanismo real seria mTLS ou OAuth2 client credentials.',
      },
      'chave-de-api',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}

/**
 * Publica a documentacao, se ela estiver habilitada.
 *
 * A rota do Swagger e montada no nivel do adaptador HTTP e nao passa pelo guard
 * global, entao ela fica aberta. Isso e uma escolha registrada no ADR-013, e nao
 * uma consequencia: o padrao de `DOCS_HABILITADO` e desligado, e quem quer a
 * documentacao no ar liga numa linha visivel de configuracao. Um ambiente que
 * esqueca a variavel nasce fechado.
 */
export function publicarDocumentacao(app: INestApplication): void {
  SwaggerModule.setup(CAMINHO_DA_DOCUMENTACAO, app, montarContrato(app), {
    customSiteTitle: 'DOC Intelligence',
    swaggerOptions: { persistAuthorization: true },
  });
}
