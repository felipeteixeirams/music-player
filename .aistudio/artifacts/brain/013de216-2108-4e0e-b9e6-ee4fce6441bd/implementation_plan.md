# Plano de Implementação — Reprodução Confiável em Segundo Plano e Interface 100% Limpa

Garantir que a música toque de fato sem bloqueios do navegador e remover qualquer menção técnica, selo ou engrenagem exposta na interface, deixando a experiência idêntica à de aplicativos comerciais como Spotify e Apple Music.

---

## 1. Diagnóstico do Problema de Reprodução

### Por que o som não estava tocando?
1. **Perda do Gesto do Usuário (*Transient User Activation Expiry*):**
   - Ao tocar em uma música, o app aguardava requisições de rede assíncronas (Piped/InnerTube) que levavam de 1.5s a 3s.
   - Navegadores mobile (Chrome Android, Safari iOS) expiram o token de clique após ~1.000ms. Quando o player tentava dar `.play()`, o navegador bloqueava por política de autoplay.
2. **Estrangulamento de Iframes Fora da Tela (*Offscreen Throttling*):**
   - Elementos em `left: -9999px` com `opacity: 0` são classificados pelo *IntersectionObserver* do navegador como invisíveis/em segundo plano, tendo sua execução de mídia pausada preventivamente.

---

## 2. Soluções de Engenharia Propostas

### A. Desbloqueio Imediato de Áudio (*Instant Audio Priming*)
- No exato momento do clique do usuário, registrar a intenção de áudio de forma síncrona, mantendo a ativação do usuário válida enquanto o link é resolvido.
- Manter o elemento de fallback posicionado dentro dos limites do DOM com camuflagem de baixa opacidade sob o fundo do player (`z-index: -1`, `pointer-events: none`), evitando que o navegador congele o fluxo de áudio.

### B. Remoção Total das Engrenagens da Interface (Estilo Spotify)
- Remover o componente `AudioEngineBadge` e qualquer texto como *"Piped Pure Stream"*, *"Piped Local"*, *"YouTube Engine"* ou *"Fallback"*.
- Exibir exclusivamente metadados artísticos reais (Título, Artista, Álbum Oficial, Ano).
- Manter todos os detalhes de diagnóstico, taxas de bits, instâncias e logs de erro exclusivamente no console do desenvolvedor via `audioLogger.ts`.

---

## 3. Arquitetura e Fluxo de Execução

```
[ Toque do Usuário na Faixa ]
         │
         ├──> 1. Desbloqueio Síncrono do Pipeline de Áudio (Mobile Autoplay Permitido)
         │
         ├──> 2. Resolução do Melhor Stream em Paralelo no Backend
         │         │
         │         ├──> A. Stream Direto Disponível? Toca no Audio Player Nativo
         │         └──> B. Restrição de CDN? Toca no Motor Iframe Camuflado Sem Parar
         │
         └──> 3. Interface Limpa: Sem selos técnicos, apenas capa, letra sincronizada e controles
```

---

## 4. Plano de Verificação

1. **Teste no Playwright:**
   - Buscar uma faixa comercial (ex.: *"One Last Breath"* ou *"Believer"*).
   - Clicar na faixa e verificar que o áudio inicia e o progresso do cronômetro avança em segundos reais.
   - Confirmar ausência de selos técnicos na tela (apenas capa, título e controles).
2. **Validação de Compilação:**
   - `npm run lint` e `npm run build` com 0 erros.
