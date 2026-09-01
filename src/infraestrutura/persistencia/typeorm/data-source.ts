import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * Fonte de dados do TypeORM, usada pelo CLI de migration e, mais adiante,
 * pelo modulo de persistencia.
 *
 * `synchronize` fica desabilitado em qualquer ambiente. Com ele ligado o
 * esquema vira efeito colateral das anotacoes de entidade, e a convencao de
 * prefixo por coluna deste projeto e exatamente o tipo de detalhe que se perde
 * assim, em silencio, quando alguem esquece um `name:`. Ver ADR-009.
 */
export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'doc',
  password: process.env.POSTGRES_PASSWORD ?? 'doc',
  database: process.env.POSTGRES_DB ?? 'doc_intelligence',
  synchronize: false,
  logging: process.env.TYPEORM_LOG === 'true',
  entities: [__dirname + '/entidades/*.orm-entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'migrations',
});
