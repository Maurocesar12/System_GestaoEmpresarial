import {
  atendimentoFormSchema,
  cadastroSchema,
  clienteFormSchema,
  loginSchema,
  orcamentoFormSchema,
  servicoFormSchema,
} from '@gestao/shared-types';
import type { ZodType } from 'zod';

/**
 * Todo schema de formulário precisa ser **idempotente**: validar o resultado de
 * uma validação tem que devolver o mesmo resultado.
 *
 * Isto não é preciosismo. Os schemas são validados duas vezes — no formulário,
 * para dar resposta imediata a quem digita, e na Server Action, porque
 * validação de cliente nunca é garantia. Um schema que transforma os dados e
 * não aceita o próprio resultado de volta quebra na segunda passada.
 *
 * Foi exatamente o que derrubou o cadastro de cliente: campos opcionais viravam
 * `null` na primeira validação, e a segunda os recusava com "Invalid input" —
 * inclusive campos de UTM, que nem aparecem na tela. A mensagem de erro não dava
 * pista nenhuma de onde estava o problema.
 */

/** Dados válidos e realistas para cada schema, como sairiam do formulário. */
const CASOS: { nome: string; schema: ZodType; entrada: unknown }[] = [
  {
    nome: 'clienteFormSchema',
    schema: clienteFormSchema,
    entrada: {
      nome: 'Teste Silva',
      telefone: '(21) 99656-2335',
      email: 'teste@gmail.com',
      documento: '173.153.067-65',
      origem: 'Instagram',
      observacoes: 'cliente indicado',
    },
  },
  {
    nome: 'clienteFormSchema (só o obrigatório)',
    schema: clienteFormSchema,
    // O caso que quebrava: tudo o que é opcional vem vazio e vira `null`.
    entrada: { nome: 'Maria Souza', telefone: '', email: '', documento: '' },
  },
  {
    nome: 'servicoFormSchema',
    schema: servicoFormSchema,
    entrada: { nome: 'Instalação', custoBase: '250,00', precoPadrao: '600,00' },
  },
  {
    nome: 'servicoFormSchema (sem preço)',
    schema: servicoFormSchema,
    entrada: { nome: 'Consulta', custoBase: '0,00', precoPadrao: '', categoria: '' },
  },
  {
    nome: 'orcamentoFormSchema',
    schema: orcamentoFormSchema,
    entrada: {
      clienteId: '019ffb57-6e44-743d-bc04-f9e7231d8c5b',
      valor: '1.500,00',
      servicoId: '',
      descricao: '',
      validoAte: '',
    },
  },
  {
    nome: 'atendimentoFormSchema',
    schema: atendimentoFormSchema,
    entrada: { descricao: 'Visita técnica', data: '2026-08-14' },
  },
  {
    nome: 'loginSchema',
    schema: loginSchema,
    entrada: { email: '  Teste@Exemplo.COM ', senha: 'senhaSegura123' },
  },
  {
    nome: 'cadastroSchema',
    schema: cadastroSchema,
    entrada: {
      nomeEmpresa: 'Oficina do João',
      nomeResponsavel: 'João da Silva',
      email: 'joao@exemplo.com',
      senha: 'senhaSegura123',
    },
  },
];

describe('schemas de formulário são idempotentes', () => {
  it.each(CASOS)('$nome aceita o próprio resultado de volta', ({ schema, entrada }) => {
    const primeira = schema.safeParse(entrada);

    // Pré-condição: os dados de exemplo precisam ser válidos, senão o teste
    // passaria sem testar nada.
    expect(primeira.success).toBe(true);

    const segunda = schema.safeParse(primeira.data);

    if (!segunda.success) {
      // Mensagem útil no lugar de "expected true, got false": diz qual campo
      // recusou o próprio valor.
      const problemas = segunda.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');

      throw new Error(`Schema não é idempotente. Campos que recusaram: ${problemas}`);
    }

    // Além de aceitar, precisa devolver exatamente o mesmo valor — senão uma
    // terceira validação poderia divergir de novo.
    expect(segunda.data).toEqual(primeira.data);
  });
});
