/**
 * Informações públicas da aplicação.
 *
 * Mantenha nome, descrição e cores neste arquivo para que cabeçalho,
 * metadados e manifesto não apresentem versões diferentes da mesma marca.
 */
const urlPublica =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const SITE = {
  nome: 'Gestão Empresarial',
  nomeCurto: 'Gestão',
  descricao: 'CRM e financeiro no mesmo lugar, para pequenas e médias empresas de serviço.',
  idioma: 'pt-BR',
  locale: 'pt_BR',
  corMarca: '#111111',
  corFundo: '#f7f7f7',
  corFundoEscuro: '#050505',
  url: new URL(urlPublica),
} as const;
