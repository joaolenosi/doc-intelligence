import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria a fila em banco e a trilha de auditoria.
 *
 * A fila e criada sempre, independente de qual adaptador esteja ativo em
 * FILA_ADAPTADOR. Migration condicional a variavel de ambiente produz bancos
 * diferentes com o mesmo numero de migration, o que transforma qualquer
 * diagnostico futuro em adivinhacao. Uma tabela vazia nao custa nada.
 */
export class CriaFilaEAuditoria1788184830000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE fila_processamento (
        flp_id            BIGSERIAL    PRIMARY KEY,
        flp_doc_id        BIGINT       NOT NULL,
        flp_situacao      VARCHAR(20)  NOT NULL DEFAULT 'PENDENTE',
        flp_tentativas    SMALLINT     NOT NULL DEFAULT 0,
        flp_disponivel_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        flp_reservado_em  TIMESTAMPTZ  NULL,
        flp_reservado_por VARCHAR(100) NULL,
        flp_criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        flp_atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_flp_doc FOREIGN KEY (flp_doc_id)
          REFERENCES documento (doc_id) ON DELETE CASCADE,
        CONSTRAINT ck_flp_situacao CHECK (flp_situacao IN
          ('PENDENTE','EM_EXECUCAO','CONCLUIDO','FALHOU'))
      )
    `);

    // Indice parcial porque o consumo so pergunta por PENDENTE que ja venceu o
    // backoff. Trabalho concluido fica na tabela para historico e nao precisa
    // continuar pesando no indice que o worker consulta a cada ciclo.
    await queryRunner.query(`
      CREATE INDEX ix_flp_pendente_disponivel_em
        ON fila_processamento (flp_disponivel_em)
        WHERE flp_situacao = 'PENDENTE'
    `);

    await queryRunner.query(`
      CREATE TABLE evento_auditoria (
        eva_id        BIGSERIAL    PRIMARY KEY,
        eva_doc_id    BIGINT       NULL,
        eva_acao      VARCHAR(50)  NOT NULL,
        eva_ator      VARCHAR(100) NOT NULL,
        eva_detalhe   JSONB        NOT NULL DEFAULT '{}'::JSONB,
        eva_criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_eva_doc FOREIGN KEY (eva_doc_id)
          REFERENCES documento (doc_id) ON DELETE SET NULL
      )
    `);

    // ON DELETE SET NULL, e nao CASCADE como nas demais. O registro de que
    // alguem acessou um documento precisa sobreviver ao apagamento do
    // documento: quando a politica de retencao existir, apagar o dado pessoal
    // nao pode apagar a prova de quem o acessou antes.
    await queryRunner.query(`
      CREATE INDEX ix_eva_doc_criado_em ON evento_auditoria (eva_doc_id, eva_criado_em DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE evento_auditoria`);
    await queryRunner.query(`DROP TABLE fila_processamento`);
  }
}
