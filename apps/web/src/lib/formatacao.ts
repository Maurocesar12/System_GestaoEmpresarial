function partesDataISO(iso: string): [ano: string, mes: string, dia: string] {
  const [ano = '', mes = '', dia = ''] = iso.split('-');
  return [ano, mes, dia];
}

export function formatarDataCurta(iso: string): string {
  const [, mes, dia] = partesDataISO(iso);
  return `${dia}/${mes}`;
}

export function formatarDataCompleta(iso: string): string {
  const [ano, mes, dia] = partesDataISO(iso);
  return `${dia}/${mes}/${ano}`;
}

export function formatarPeriodo(de: string, ate: string): string {
  return `${formatarDataCompleta(de)} a ${formatarDataCompleta(ate)}`;
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatarDataLonga(iso: string): string {
  return dataLocalDeISO(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatarDiaAgenda(iso: string): string {
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  if (iso === paraISO(hoje)) return 'Hoje';
  if (iso === paraISO(amanha)) return 'Amanhã';

  return dataLocalDeISO(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function dataLocalDeISO(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano!, mes! - 1, dia!);
}

function paraISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`;
}
