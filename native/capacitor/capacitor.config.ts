import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Casco de teste: uma tela nativa que abre o app em produção. O app web continua sendo o de sempre (a mesma origem
 * da API, então `api/_guard.ts` não muda), e o que se testa é só o que o iOS faz com o iframe do YouTube dentro de
 * um aplicativo nativo. Mude `PRODUCTION_URL` se o domínio de produção for outro.
 */
const PRODUCTION_URL = 'https://music-player-two-gold.vercel.app';

const config: CapacitorConfig = {
  appId: 'br.com.aurastream.casco',
  appName: 'Aurastream Teste',
  // Capacitor exige um diretório de arquivos mesmo quando `server.url` é usado: um marcador mínimo (www/index.html)
  webDir: 'www',
  server: {
    url: PRODUCTION_URL,
    cleartext: false
  },
  ios: {
    // O Safari Web Inspector funciona em builds de depuração para ver o console do app
    webContentsDebuggingEnabled: true
  }
};

export default config;
