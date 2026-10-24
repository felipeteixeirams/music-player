# Plano de Implementação — Integração Avançada (YouTube Music, LRCLIB e Audio Proxy)

Plano de arquitetura para implementar busca oficial no YouTube Music, letras sincronizadas via LRCLIB e streaming contínuo de áudio via proxy no backend Node.js.

## Decisões Críticas e Alinhamento com o Usuário

> [!IMPORTANT]
> O usuário confirmou o desejo de integrar **YouTube Music**, **LRCLIB** (letras sincronizadas) e **Streaming contínuo de áudio via proxy no backend** para garantir reprodução estável sem bloqueios de IP do Google.

- **YouTube Music / InnerTube Search**: Busca estritamente filtrada por categoria de música (songs) para retornar apenas gravações oficiais de estúdio e artistas renomados.
- **LRCLIB API**: Consulta assíncrona em tempo real para exibir letras sincronizadas por carimbo de tempo (`.lrc`).
- **Backend Audio Proxy**: O backend atua como gateway de streaming, recebendo o ID do YouTube, resolvendo a URL crua do CDN e transmitindo os pacotes de áudio de forma contínua para o cliente PWA.

---

## 1. Visão Geral e Conceito do Produto

- **Objetivo**: Elevar o AuraStream a um player PWA de altíssimo padrão, com catálogo oficial, letras sincronizadas e reprodução robusta na nuvem.
- **Experiência do Usuário**: Pesquisa inteligente, capa em alta resolução, letras em tempo real acompanhando o ritmo da música e player otimizado para dispositivos móveis.

---

## 2. Experiência do Usuário e Design Visual

- **Aba de Letras Sincronizadas**: Nova aba no Player Expandido destacando a frase atual da música com rolagem suave em tempo real com base no progresso de reprodução.
- **Busca Online Inteligente**: Resultados refinados direto do YouTube Music com indicação de artista, álbum e selo de alta fidelidade.

---

## 3. Decisões de Engenharia e Trade-offs

- **Decisão 1: Proxy de Áudio no Backend (`/api/stream`)**
  - *Abordagem*: O servidor Node.js intermedeia a conexão com a CDN do Google para evitar erros de CORS e restrições de IP do cliente.
  - *Motivo*: Garante compatibilidade universal em qualquer navegador mobile.
- **Decisão 2: LRCLIB para Letras**
  - *Abordagem*: Consumo direto da API pública `https://lrclib.net` utilizando `artist_name` e `track_name`.
  - *Motivo*: Solução gratuita e estável sem necessidade de chaves de API.

---

## 4. Arquitetura Técnica

```
┌──────────────────────────────────────────────────────────────┐
│                      PWA MOBILE CLIENT                       │
│  Busca / Reprodução / Exibição de Letras Sincronizadas (LRC) │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼ (/api/search)                 ▼ (https://lrclib.net)
┌──────────────────────────────┐ ┌─────────────────────────────┐
│    NODE.JS VERCEL BACKEND    │ │         LRCLIB API          │
│    YouTube Music Search      │ │    Letras Sincronizadas     │
└──────────────┬───────────────┘ └─────────────────────────────┘
               │
               ▼ (/api/stream?id=...)
┌──────────────────────────────────────────────────────────────┐
│                    AUDIO PROXY GATEWAY                       │
│         Stream Contínuo de Áudio da CDN do Google            │
└──────────────────────────────────────────────────────────────┘
```
