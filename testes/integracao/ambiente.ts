import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSource } from '../../src/infraestrutura/persistencia/typeorm/data-source';

/**
 * Sobe a conexao e limpa o estado entre testes.
 *
 * Nao limpa `tipo_documento`: ele e semeado por migration e e dado de
 * configuracao, nao de teste. Apagar faria o proximo teste rodar contra um
 * catalogo vazio e o erro apareceria longe da causa.
 */
export async function conectar(): Promise<DataSource> {
  if (!dataSource.isInitialized) await dataSource.initialize();
  await dataSource.runMigrations();
  return dataSource;
}

export async function limpar(ds: DataSource): Promise<void> {
  // A ordem nao importa por causa do CASCADE, mas apagar o documento sozinho
  // deixaria a auditoria com doc_id nulo acumulando entre testes.
  await ds.query('TRUNCATE evento_auditoria, fila_processamento, processamento, campo_extraido, submissao, documento RESTART IDENTITY CASCADE');
}
