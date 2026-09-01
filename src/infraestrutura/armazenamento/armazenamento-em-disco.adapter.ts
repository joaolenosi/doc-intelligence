import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ArmazenamentoDeArquivo } from '../../aplicacao/portas/armazenamento-de-arquivo.porta';
import { ChaveArmazenamento } from '../../dominio/documento/chave-armazenamento.vo';

/**
 * Guarda o binario em disco local.
 *
 * A chave e gerada aqui e nunca recebida. E o que garante que o caminho no
 * disco nao deriva de nada que veio de fora: o nome que a pessoa deu ao arquivo
 * nao chega ate esta classe. Fato (b).
 *
 * Os arquivos ficam em `<diretorio>/<aa>/<bb>/<uuid>.<extensao>`, com os dois
 * primeiros pares de caracteres do UUID como subdiretorios, porque um diretorio
 * unico com 150 arquivos por dia vira dezenas de milhares em um ano e alguns
 * sistemas de arquivos degradam ai.
 *
 * Trocar por object storage e escrever outra classe com esta interface. Ver
 * `docs/escopo-nao-implementado.md`.
 */
export class ArmazenamentoEmDisco implements ArmazenamentoDeArquivo {
  constructor(private readonly diretorioBase: string) {}

  async guardar(conteudo: Uint8Array, extensao: string): Promise<ChaveArmazenamento> {
    const chave = ChaveArmazenamento.de(randomUUID());
    const caminho = this.caminhoDe(chave, extensao);
    await mkdir(join(caminho, '..'), { recursive: true });
    await writeFile(caminho, conteudo);
    return chave;
  }

  async ler(chave: ChaveArmazenamento): Promise<Uint8Array> {
    // A extensao nao faz parte da identidade, entao a leitura procura o arquivo
    // pelo prefixo do UUID. Guardar a extensao no nome e conveniencia para quem
    // abrir o diretorio na mao, e nao informacao de que o sistema depende.
    const diretorio = join(this.diretorioBase, ...this.fatias(chave));
    const arquivos = await readdir(diretorio);
    const encontrado = arquivos.find((nome) => nome.startsWith(chave.valor));
    if (encontrado === undefined) {
      throw new Error(`Arquivo da chave ${chave.valor} nao encontrado`);
    }
    return readFile(join(diretorio, encontrado));
  }

  private fatias(chave: ChaveArmazenamento): [string, string] {
    return [chave.valor.slice(0, 2), chave.valor.slice(2, 4)];
  }

  private caminhoDe(chave: ChaveArmazenamento, extensao: string): string {
    return join(this.diretorioBase, ...this.fatias(chave), `${chave.valor}.${extensao}`);
  }
}
