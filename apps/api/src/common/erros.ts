import { ConflictException, NotFoundException } from '@nestjs/common';
import { CODIGOS_ERRO } from '@gestao/shared-types';

/*
 * Erros no formato que a tela entende (`codigo` + `mensagem`).
 *
 * Existiam escritos à mão em cada serviço, quatro linhas por vez. Num só
 * lugar, o formato não tem como divergir entre um módulo e outro.
 */

/** 404. @example throw naoEncontrado('Lançamento não encontrado.'); */
export function naoEncontrado(mensagem: string): NotFoundException {
  return new NotFoundException({ codigo: CODIGOS_ERRO.NAO_ENCONTRADO, mensagem });
}

/** 409: a ação conflita com o estado atual. @example throw conflito('E-mail já cadastrado.'); */
export function conflito(mensagem: string): ConflictException {
  return new ConflictException({ codigo: CODIGOS_ERRO.CONFLITO, mensagem });
}
