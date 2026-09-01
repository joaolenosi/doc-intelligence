import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RespostaDeSaude } from './dto/respostas.dto';
import { SemAutenticacao } from './guards/sem-autenticacao.decorator';

/**
 * Existe para o README ter como dizer "subiu", e para o compose ter como
 * esperar a API ficar de pe antes de declarar o ambiente pronto.
 *
 * Consulta o banco de proposito: processo respondendo com o banco fora nao esta
 * saudavel, so esta vivo.
 */
@ApiTags('saude')
@Controller('healthz')
@SemAutenticacao()
export class SaudeController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Verifica se o servico esta de pe e enxerga o banco' })
  @ApiOkResponse({ type: RespostaDeSaude })
  async verificar() {
    await this.dataSource.query('SELECT 1');
    return { estado: 'ok', banco: 'ok' };
  }
}
