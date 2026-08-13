import { SetMetadata } from '@nestjs/common';

export const CHAVE_ROTA_PUBLICA = 'rota_publica';

/**
 * Marca uma rota como acessível sem autenticação.
 *
 * O padrão do projeto é o inverso: **toda rota exige login**, porque o guard
 * está registrado globalmente. Liberar exige escrever `@Publico()` de forma
 * visível, o que torna cada exceção uma decisão consciente.
 *
 * Se fosse ao contrário — proteger só o que tem decorator —, esquecer um
 * `@UsarAuth()` deixaria a rota aberta em silêncio. Aqui, esquecer resulta em
 * rota fechada: o erro aparece na hora, e é do tipo que não vaza dado.
 *
 * @example
 * ```ts
 * @Publico()
 * @Post('login')
 * login(@Body() dados: LoginInput) {}
 * ```
 */
export const Publico = () => SetMetadata(CHAVE_ROTA_PUBLICA, true);
