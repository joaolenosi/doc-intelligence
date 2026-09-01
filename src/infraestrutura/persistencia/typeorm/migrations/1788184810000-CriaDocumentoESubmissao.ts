import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o documento e a submissao.
 *
 * Sao duas tabelas e nao uma porque o fato (c) diz que o mesmo documento chega
 * mais de uma vez. O documento e o conteudo, identificado pelo hash. A
 * submissao e cada envio daquele conteudo, com o nome que a pessoa deu e o
 * sistema por onde chegou. Guardar nome e origem no documento preservaria so o
 * primeiro envio. Ver ADR-006.
 */
export class CriaDocumentoESubmissao1788184810000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // doc_chave_armazenamento e um UUID gerado por nos e e a unica coisa que
    // vira caminho no disco. O nome que veio da camera nao mora aqui: ele
    // pertence a submissao, e nunca toca o sistema de arquivos. Fato (b).
    await queryRunner.query(`
      CREATE TABLE documento (
        doc_id                  BIGSERIAL    PRIMARY KEY,
        doc_hash_conteudo       CHAR(64)     NOT NULL,
        doc_chave_armazenamento UUID         NOT NULL,
        doc_tipo_midia          VARCHAR(100) NOT NULL,
        doc_tamanho_bytes       BIGINT       NOT NULL,
        doc_situacao            VARCHAR(30)  NOT NULL,
        doc_tpd_id              INTEGER      NULL,
        doc_confianca_tipo      NUMERIC(4,3) NULL,
        doc_nome_sugerido       TEXT         NULL,
        doc_versao              SMALLINT     NOT NULL DEFAULT 1,
        doc_criado_em           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        doc_atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        doc_processado_em       TIMESTAMPTZ  NULL,
        CONSTRAINT uq_doc_hash_conteudo       UNIQUE (doc_hash_conteudo),
        CONSTRAINT uq_doc_chave_armazenamento UNIQUE (doc_chave_armazenamento),
        CONSTRAINT fk_doc_tpd FOREIGN KEY (doc_tpd_id) REFERENCES tipo_documento (tpd_id),
        CONSTRAINT ck_doc_situacao CHECK (doc_situacao IN
          ('RECEIVED','PROCESSING','PROCESSED','REVIEW_REQUIRED','FAILED','REJECTED')),
        CONSTRAINT ck_doc_tamanho_positivo CHECK (doc_tamanho_bytes > 0),
        CONSTRAINT ck_doc_confianca_faixa CHECK
          (doc_confianca_tipo IS NULL OR (doc_confianca_tipo >= 0 AND doc_confianca_tipo <= 1))
      )
    `);

    // Serve a reconciliacao de documentos travados em RECEIVED e, mais tarde,
    // a fila de conferencia do fato (g).
    await queryRunner.query(`
      CREATE INDEX ix_doc_situacao_criado_em ON documento (doc_situacao, doc_criado_em)
    `);

    await queryRunner.query(`
      CREATE TABLE submissao (
        sub_id                   BIGSERIAL    PRIMARY KEY,
        sub_doc_id               BIGINT       NOT NULL,
        sub_nome_original        TEXT         NOT NULL,
        sub_tipo_midia_informado VARCHAR(100) NULL,
        sub_sistema_origem       VARCHAR(50)  NOT NULL,
        sub_chave_idempotencia   VARCHAR(100) NULL,
        sub_criado_em            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_sub_doc FOREIGN KEY (sub_doc_id)
          REFERENCES documento (doc_id) ON DELETE CASCADE
      )
    `);

    // Unicidade da chave de idempotencia por sistema, e nao global. Dois
    // sistemas internos geram identificador sem coordenacao entre si, e numa
    // colisao acidental o segundo teria o envio descartado em silencio. Parcial
    // porque a chave e opcional. Ver ADR-006.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_sub_sistema_idempotencia
        ON submissao (sub_sistema_origem, sub_chave_idempotencia)
        WHERE sub_chave_idempotencia IS NOT NULL
    `);

    // O GET devolve o nome da submissao mais recente. Sem este indice, isso e
    // varredura em todas as submissoes do documento.
    await queryRunner.query(`
      CREATE INDEX ix_sub_doc_criado_em ON submissao (sub_doc_id, sub_criado_em DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE submissao`);
    await queryRunner.query(`DROP TABLE documento`);
  }
}
