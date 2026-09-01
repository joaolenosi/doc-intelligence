import { Client } from 'pg';

/**
 * Cria o banco de testes, se ainda nao existir.
 *
 * Os testes de integracao usam um banco proprio, e nao o mesmo do
 * `docker compose`. O motivo apareceu na pratica: com o ambiente de pe e
 * FILA_ADAPTADOR=postgres, o worker do compose consome a tabela
 * `fila_processamento` e rouba as linhas que o teste acabou de inserir. Os
 * testes passavam isolados e falhavam de forma intermitente na suite inteira,
 * que e a pior forma de falhar.
 */
export const BASE_DE_TESTE = process.env.POSTGRES_DB_TESTE ?? 'doc_intelligence_teste';

export default async function preparar(): Promise<void> {
  const cliente = new Client({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'doc',
    password: process.env.POSTGRES_PASSWORD ?? 'doc',
    database: 'postgres',
  });

  await cliente.connect();
  const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [BASE_DE_TESTE]);
  if (existe.rowCount === 0) {
    // Nome vem de constante ou de variavel de ambiente do proprio
    // desenvolvedor, e CREATE DATABASE nao aceita parametro. A checagem de
    // formato evita que uma variavel mal preenchida vire SQL.
    if (!/^[a-z_][a-z0-9_]*$/.test(BASE_DE_TESTE)) {
      throw new Error(`Nome de banco de teste invalido: ${BASE_DE_TESTE}`);
    }
    await cliente.query(`CREATE DATABASE ${BASE_DE_TESTE}`);
  }
  await cliente.end();
}
