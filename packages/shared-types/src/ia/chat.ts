import { z } from 'zod';

export const chatIaSchema = z.object({
  mensagem: z.string().trim().min(2, 'Digite uma pergunta.').max(1_000, 'Pergunta muito longa.'),
});

export type ChatIaInput = z.infer<typeof chatIaSchema>;

export interface ChatIaResponse {
  modo: 'gratuito' | 'premium';
  resposta: string;
  sugestoes: string[];
}
