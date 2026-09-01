import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o catalogo de tipos de documento.
 *
 * Vem primeiro porque `documento` referencia esta tabela por chave
 * estrangeira. O template do nome e a lista de campos obrigatorios moram aqui,
 * e nao em constante no codigo, porque as duas coisas sao decisao de negocio:
 * o padrao de nomes do escritorio muda sem aviso, e e a lista de obrigatorios
 * que permite exigir conferencia de uma identidade sem numero sem exigir o
 * mesmo de um contrato. Ver ADR-010.
 */
export class CriaCatalogoDeTipos1788184800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tipo_documento (
        tpd_id                  SERIAL       PRIMARY KEY,
        tpd_codigo              VARCHAR(50)  NOT NULL,
        tpd_nome                VARCHAR(100) NOT NULL,
        tpd_template_nome       TEXT         NOT NULL,
        tpd_campos_obrigatorios TEXT[]       NOT NULL DEFAULT '{}',
        tpd_ativo               BOOLEAN      NOT NULL DEFAULT TRUE,
        tpd_criado_em           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_tpd_codigo UNIQUE (tpd_codigo)
      )
    `);

    // DESCONHECIDO existe como linha e sem campos obrigatorios. Tipo que o
    // extrator devolver fora do catalogo cai aqui e o documento vai para
    // REVIEW_REQUIRED, porque tipo que o sistema nao conhece e precisamente o
    // caso em que ele nao deveria decidir sozinho.
    await queryRunner.query(`
      INSERT INTO tipo_documento (tpd_codigo, tpd_nome, tpd_template_nome, tpd_campos_obrigatorios) VALUES
        ('RG',                     'Documento de identidade', '{tipo}_{nome}_{numero}_{data}.{extensao}',       ARRAY['nome','filiacao','dataNascimento','numero','orgaoEmissor']),
        ('CPF',                    'CPF',                     '{tipo}_{nome}_{numero}_{data}.{extensao}',       ARRAY['nome','numero']),
        ('COMPROVANTE_RESIDENCIA', 'Comprovante de residencia','{tipo}_{titular}_{dataReferencia}.{extensao}',  ARRAY['titular','endereco','dataReferencia']),
        ('CONTRACHEQUE',           'Contracheque',            '{tipo}_{nome}_{competencia}.{extensao}',         ARRAY['nome','competencia','valorLiquido']),
        ('DESCONHECIDO',           'Nao identificado',        '{tipo}_{data}.{extensao}',                       ARRAY[]::TEXT[])
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tipo_documento`);
  }
}
