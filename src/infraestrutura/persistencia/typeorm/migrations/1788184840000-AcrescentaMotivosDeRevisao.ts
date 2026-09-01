import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acrescenta ao documento os motivos que o mandaram para conferencia humana.
 *
 * Sem esta coluna o estado REVIEW_REQUIRED diz que o documento parou e nao diz
 * por que. Confianca baixa no tipo e "faltou o numero da identidade" levam a
 * conferencias diferentes, e quem consome precisa saber qual e qual.
 *
 * Guarda codigo e nome de campo, nunca valor. Fato (d).
 *
 * Migration nova em vez de edicao da 1788184810000, que ja esta commitada.
 * Migration ja aplicada em qualquer lugar e imutavel, senao dois bancos com o
 * mesmo numero passam a ter esquemas diferentes.
 */
export class AcrescentaMotivosDeRevisao1788184840000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documento ADD COLUMN doc_motivos_revisao TEXT[] NULL
    `);

    // Motivo so faz sentido em documento que parou para conferencia. A
    // restricao impede que alguem grave motivo em documento processado, o que
    // faria a consulta "por que estes documentos pararam" devolver ruido.
    await queryRunner.query(`
      ALTER TABLE documento ADD CONSTRAINT ck_doc_motivos_coerentes CHECK (
        (doc_situacao = 'REVIEW_REQUIRED' AND doc_motivos_revisao IS NOT NULL
          AND array_length(doc_motivos_revisao, 1) >= 1)
        OR (doc_situacao <> 'REVIEW_REQUIRED' AND doc_motivos_revisao IS NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE documento DROP CONSTRAINT ck_doc_motivos_coerentes`);
    await queryRunner.query(`ALTER TABLE documento DROP COLUMN doc_motivos_revisao`);
  }
}
