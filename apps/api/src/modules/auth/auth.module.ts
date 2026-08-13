import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { SenhaService } from './senha.service';

/**
 * Autenticação.
 *
 * `@Global` por causa do `JwtModule`: o `TenantMiddleware` precisa do
 * `JwtService` para verificar o token, e ele é registrado no módulo raiz.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        // O tempo de expiração é definido na emissão de cada token, e não aqui,
        // porque access e refresh têm validades diferentes.
        signOptions: {},
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SenhaService, RefreshTokenService],
  exports: [AuthService, SenhaService, RefreshTokenService, JwtModule],
})
export class AuthModule {}
