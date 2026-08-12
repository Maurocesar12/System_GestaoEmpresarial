/** Resposta de `GET /health` — usada pelo Render e pelo smoke test do frontend. */
export interface HealthResponse {
  status: 'ok' | 'degradado';
  versao: string;
  ambiente: string;
  timestamp: string;
}
//# sourceMappingURL=health.d.ts.map
