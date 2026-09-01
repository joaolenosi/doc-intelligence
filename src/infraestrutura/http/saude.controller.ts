import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SemAutenticacao } from './guards/sem-autenticacao.decorator';

/**
 * Existe para o README ter como dizer "subiu", e para o compose ter como
 * esperar a API ficar de pe antes de declarar o ambiente pronto.
 *
 * Consulta o banco de proposito: processo respondendo com o banco fora nao esta
 * saudavel, so esta vivo.
 */
@Controller('healthz')
@SemAutenticacao()
export class SaudeController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async verificar() {
    await this.dataSource.query('SELECT 1');
    return { estado: 'ok', banco: 'ok' };
  }
}
