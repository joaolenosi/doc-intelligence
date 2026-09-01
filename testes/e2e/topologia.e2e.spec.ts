import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { SISTEMA, enviar, esperarSituacaoFinal, jpeg } from './apoio';

/**
 * Prova que a API e o worker sao processos separados de verdade.
 *
 * O teste anterior, que espera o documento ficar pronto, passa em 40
 * milissegundos, e velocidade assim levanta a duvida certa: sera que quem
 * processou foi o worker, ou tem processamento escondido dentro da API?
 *
 * A unica forma honesta de responder e derrubar o worker e verificar que o
 * documento nao anda. Se ele andasse, o ADR-003 estaria escrito e nao
 * implementado, e a afirmacao de que o processamento nao depende do ciclo da
 * requisicao seria falsa.
 *
 * Este arquivo mexe no ambiente, entao roda sozinho e sempre devolve o worker
 * ao lugar, mesmo quando falha.
 */

const compose = (comando: string): void => {
  execSync(`docker compose ${comando}`, { stdio: 'pipe' });
};

test.describe.configure({ mode: 'serial' });

test.afterAll(() => {
  // O worker volta a subir aconteca o que acontecer, senao uma falha aqui
  // quebraria todos os testes seguintes por um motivo que nao e o deles.
  try {
    compose('start worker');
  } catch {
    // Se nem isso funcionar, o proximo `docker compose up -d` resolve.
  }
});

test('sem worker o documento nao anda, e com worker ele anda', async ({ request }) => {
  compose('stop worker');

  const criado = await enviar(request, {
    conteudo: jpeg(`topologia-${Date.now()}`),
    nome: 'rg.jpeg',
    sistema: SISTEMA,
  });

  // A API responde na hora mesmo sem ninguem para processar. E o ADR-003: o
  // upload nao depende do modelo, e o pico do fato (e) e absorvido pela fila.
  expect(criado.status()).toBe(201);
  const { id } = await criado.json();

  // Alguns segundos sao suficientes: com o worker no ar, o duble termina em
  // dezenas de milissegundos.
  await new Promise((resolver) => setTimeout(resolver, 4000));

  const parado = await request.get(`/v1/documentos/${id}`);
  const corpoParado = await parado.json();
  expect(corpoParado.estado).toBe('RECEIVED');
  expect(corpoParado.processamento.tentativas).toBe(0);
  expect(corpoParado.campos).toEqual([]);

  // O trabalho ficou esperando, e nao se perdeu.
  compose('start worker');

  const final = await esperarSituacaoFinal(request, id, 60);
  expect(['PROCESSED', 'REVIEW_REQUIRED']).toContain(final.estado);
  expect(final.processamento.tentativas).toBe(1);
  expect(final.processamento.modelo).toBe('duble-deterministico-1');
});
