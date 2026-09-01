import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ConsultarDocumento } from '../../aplicacao/casos-de-uso/consultar-documento.caso-de-uso';
import { ReceberDocumento } from '../../aplicacao/casos-de-uso/receber-documento.caso-de-uso';
import { Configuracao } from '../config/configuracao';
import { DocumentosController } from '../http/documentos.controller';
import { FiltroDeErro } from '../http/filtros/filtro-de-erro';
import { ApiKeyGuard } from '../http/guards/api-key.guard';
import { SaudeController } from '../http/saude.controller';
import { compor } from './composicao';

/**
 * O modulo da API.
 *
 * O Nest so aparece a partir daqui, e ele monta controller, guard e filtro. Os
 * casos de uso chegam prontos da composicao, por fabrica: e a fronteira do
 * ADR-002 sendo respeitada no unico lugar onde o framework tem permissao para
 * existir.
 */
@Module({})
export class ApiModule {
  static registrar(configuracao: Configuracao, dataSource: DataSource): DynamicModule {
    const dependencias = compor({ configuracao, dataSource });

    return {
      module: ApiModule,
      controllers: [DocumentosController, SaudeController],
      providers: [
        { provide: DataSource, useValue: dataSource },
        { provide: ReceberDocumento, useValue: dependencias.receber },
        { provide: ConsultarDocumento, useValue: dependencias.consultar },
        // O guard e global: rota nova nasce protegida, em vez de depender de
        // alguem lembrar de decorar. A unica excecao e `healthz`, marcada com
        // @SemAutenticacao na propria rota.
        {
          provide: APP_GUARD,
          inject: [Reflector],
          useFactory: (reflector: Reflector) =>
            new ApiKeyGuard(configuracao.apiKey, reflector),
        },
        { provide: APP_FILTER, useClass: FiltroDeErro },
      ],
    };
  }
}
