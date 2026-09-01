import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { dataSource } from '../../src/infraestrutura/persistencia/typeorm/data-source';
import { BASE_DE_TESTE } from './preparar-banco';

/**
 * A conexao dos testes de integracao.
 *
 * Aproveita as opcoes da fonte de dados real, para entidades e migrations serem
 * exatamente as mesmas, e troca so o banco. Sem essa separacao, o worker do
 * compose consome a tabela `fila_processamento` durante os testes e eles falham
 * de forma intermitente, so quando o ambiente esta de pe.
 */
export const dataSourceDeTeste = new DataSource({
  ...dataSource.options,
  database: BASE_DE_TESTE,
} as DataSourceOptions);

export async function conectar(): Promise<DataSource> {
  if (!dataSourceDeTeste.isInitialized) await dataSourceDeTeste.initialize();
  await dataSourceDeTeste.runMigrations();
  return dataSourceDeTeste;
}

/**
 * Nao limpa `tipo_documento`: ele e semeado por migration e e dado de
 * configuracao, nao de teste. Apagar faria o proximo teste rodar contra um
 * catalogo vazio e o erro apareceria longe da causa.
 */
export async function limpar(ds: DataSource): Promise<void> {
  await ds.query(
    'TRUNCATE evento_auditoria, fila_processamento, processamento, campo_extraido, submissao, documento RESTART IDENTITY CASCADE',
  );
}
