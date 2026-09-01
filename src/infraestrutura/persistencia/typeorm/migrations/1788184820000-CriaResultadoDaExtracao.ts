import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o resultado da extracao: os campos e as tentativas.
 *
 * Campo extraido tem uma linha por campo, com confianca individual, e nao um
 * JSONB com confianca agregada, porque media esconde: um RG com tres campos a
 * 0,97 e o numero a 0,40 tem media alta e e exatamente o caso que precisa de
 * olho humano. Ver ADR-007.
 *
 * Processamento tem uma linha por tentativa, e nao um contador no documento,
 * porque contador responde apenas quantas vezes falhou. Uma linha por tentativa
 * responde quanto o fornecedor custou no mes e qual a taxa real de falha dele,
 * que sao as perguntas que decidem contrato num servico cobrado por chamada.
 * Ver ADR-011.
 */
export class CriaResultadoDaExtracao1788184820000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Esta e a tabela que concentra o dado pessoal do fato (d). E a unica cujo
    // conteudo nunca pode aparecer em log, em mensagem de erro ou em resposta
    // que nao seja a consulta por identificador.
    await queryRunner.query(`
      CREATE TABLE campo_extraido (
        cae_id            BIGSERIAL    PRIMARY KEY,
        cae_doc_id        BIGINT       NOT NULL,
        cae_nome          VARCHAR(60)  NOT NULL,
        cae_valor         TEXT         NOT NULL,
        cae_confianca     NUMERIC(4,3) NOT NULL,
        cae_origem        VARCHAR(20)  NOT NULL DEFAULT 'MODELO',
        cae_atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_cae_doc FOREIGN KEY (cae_doc_id)
          REFERENCES documento (doc_id) ON DELETE CASCADE,
        CONSTRAINT uq_cae_doc_nome UNIQUE (cae_doc_id, cae_nome),
        CONSTRAINT ck_cae_origem CHECK (cae_origem IN ('MODELO','CORRECAO_HUMANA')),
        CONSTRAINT ck_cae_confianca_faixa CHECK (cae_confianca >= 0 AND cae_confianca <= 1)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE processamento (
        pro_id             BIGSERIAL     PRIMARY KEY,
        pro_doc_id         BIGINT        NOT NULL,
        pro_tentativa      SMALLINT      NOT NULL,
        pro_provedor       VARCHAR(50)   NOT NULL,
        pro_modelo         VARCHAR(100)  NOT NULL,
        pro_versao_prompt  VARCHAR(50)   NOT NULL,
        pro_sucesso        BOOLEAN       NOT NULL,
        pro_duracao_ms     INTEGER       NULL,
        pro_custo_estimado NUMERIC(10,6) NULL,
        pro_erro_codigo    VARCHAR(50)   NULL,
        pro_erro_mensagem  TEXT          NULL,
        pro_iniciado_em    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        pro_terminado_em   TIMESTAMPTZ   NULL,
        CONSTRAINT fk_pro_doc FOREIGN KEY (pro_doc_id)
          REFERENCES documento (doc_id) ON DELETE CASCADE,
        CONSTRAINT uq_pro_doc_tentativa UNIQUE (pro_doc_id, pro_tentativa),
        CONSTRAINT ck_pro_tentativa_positiva CHECK (pro_tentativa >= 1),
        CONSTRAINT ck_pro_erro_coerente CHECK (
          (pro_sucesso AND pro_erro_codigo IS NULL)
          OR (NOT pro_sucesso AND pro_erro_codigo IS NOT NULL)
        )
      )
    `);

    // O GET monta o bloco de processamento a partir da ultima tentativa.
    await queryRunner.query(`
      CREATE INDEX ix_pro_doc_iniciado_em ON processamento (pro_doc_id, pro_iniciado_em DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE processamento`);
    await queryRunner.query(`DROP TABLE campo_extraido`);
  }
}
