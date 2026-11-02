# Especificação: playlists colaborativas (esboço)

Status: **esboço para decisão, nada implementado** (2026-11-02). Pertence ao master [Contas e dados](../../masters/accounts-and-data.md). Rótulos de evidência: 🔎 lido no código deste repositório; 📖 fonte externa; 💭 hipótese ou estimativa minha, não medida.

## Objetivo

Duas ou mais pessoas **registradas no app** (hoje de 3 a 5, entradas por convite) montam e ouvem a mesma playlist: cada uma pode adicionar, remover e reordenar faixas, e todas veem a mesma lista e quem adicionou cada faixa.

## Fora de escopo (por enquanto)

- Ouvir junto em tempo real (sincronizar a reprodução entre aparelhos).
- Perfis públicos, seguir pessoas, playlists abertas a qualquer registrado.
- Notificações push de "fulano adicionou uma faixa" (ver o item sobre Web Push em [Descoberta de funcionalidades](feature-discovery.spec.md)).
- Comentários e curtidas.
- Convidar quem não tem conta: o app é fechado por convite do administrador (INV-AUTH).
- Qualquer coisa de offline de faixa: descartado em definitivo ([decisões de áudio](audio-sources-decisions.spec.md)).

## O que existe hoje (e o que isso impõe)

- 🔎 Playlists são **por usuário**: `playlists` (dono `user_id`, nome de 1 a 60 caracteres) e `playlist_tracks` (chave `(playlist_id, track_id)`, `track` em jsonb de até 8 KB, `position` inteiro) em `supabase/migrations/0001_init.sql`. O RLS é "só o dono": `playlists_own` e `playlist_tracks_own`. Gatilhos limitam 100 playlists por usuário e 500 faixas por playlist.
- 🔎 O cliente guarda e sincroniza as playlists como **um instantâneo da conta** (`UserDataSnapshot`, `src/utils/userData.ts`): compara o antes e o depois e envia só a diferença (`playlistUpserts`, `playlistTrackUpserts` com `position`, remoções); ao abrir ou voltar ao primeiro plano (no máximo a cada 30 s, `SyncAgent`) lê tudo e junta com o local. Não há Realtime nem tempo real: só atualização ao abrir, ao voltar e ao ficar online.
- 🔎 Toda chamada ao Supabase usa o token da pessoa com RLS (`createRestCaller`, sem servidor no meio). Não existe perfil nem nome de exibição: o banco só tem `auth.users`, e o e-mail nunca vai ao cliente nem ao log (INV-OBS).
- **Consequência para o desenho:** o instantâneo por conta **não serve** para uma lista com vários autores. Se duas pessoas tivessem o instantâneo da mesma playlist, a diferença de uma apagaria o que a outra acabou de adicionar. A playlist colaborativa precisa de um caminho de sincronização **por operação** (adicionar, remover, mover, renomear), como já é o histórico de reprodução e a posição dos episódios (`playHistorySync`, `podcastProgressSync`), e não de um instantâneo.

## Decisões de modelo (com recomendação)

1. **Papéis.** Dono (cria, convida, remove membros, apaga a lista), **editor** (adiciona, remove e reordena faixas) e **leitor** (só ouve). 💭 Para 3 a 5 pessoas basta dono e editor; leitor entra só se alguém pedir. **Recomendação:** começar com dono e editor.
2. **Como convidar entre registrados.** Duas saídas:
   - **Código de convite** da playlist (curto, com validade e limite de usos): o dono manda por mensagem e a pessoa digita ou abre. Não expõe quem está no app. É o mesmo gesto do login por código de 6 dígitos.
   - **Diretório de pessoas** no app (lista dos registrados por nome): mais simples de usar, mas cada convidado passa a ver todo mundo.
   **Recomendação:** código de convite. O diretório pode vir depois, se o grupo crescer.
3. **Nome de exibição.** Sem e-mail em lugar nenhum: uma nova linha em Ajustes, "Seu nome", obrigatória para compartilhar e usada nas listas de membros e em "adicionada por". Fica numa tabela `profiles` (uma linha por pessoa, legível pelos membros das mesmas playlists, não por todos).
4. **Tabelas separadas, não a mesma.** Dois caminhos para guardar a lista compartilhada:
   - (A) reaproveitar `playlists` e `playlist_tracks` com uma coluna `shared` e tirar as compartilhadas do instantâneo;
   - (B) **tabelas novas** `shared_playlists` e `shared_playlist_tracks`.
   **Recomendação: B.** Mantém o RLS "só o dono" das playlists pessoais intocado (as garantias do `INV-DATA` e do esquema continuam valendo) e impede o instantâneo antigo de tocar na lista compartilhada. "Compartilhar uma playlist minha" vira **copiar** a lista para uma nova compartilhada; a original continua pessoal.
5. **Posição.** O inteiro `position` com a diferença por faixa não aguenta duas pessoas movendo ao mesmo tempo. **Recomendação:** `position` numérico fracionário (a faixa movida recebe um valor entre os vizinhos, como em listas reordenáveis de editores) com desempate por `added_at` e `track_id`. Concorrência: vale a última gravação por faixa; nunca perde faixa, no pior caso a ordem difere por um instante e converge na próxima leitura.
6. **Remover faixa.** Linha apagada de verdade (sem lápide) enquanto a leitura for a lista inteira; se um dia a leitura passar a ser incremental, entram lápides (`removed_at`). Em 💭 a lista inteira é suficiente neste tamanho (até 500 faixas, com o `track` de cerca de 1 KB cada, na ordem de centenas de KB; falta medir).
7. **Quem sai ou é removido.** O membro pode sair; o dono remove membros. Faixas adicionadas por quem saiu **ficam** (`added_by` vira nulo). Se o **dono** sai ou a conta dele é apagada, a lista passa ao editor mais antigo; sem editor, é apagada. 💭 Decisão a confirmar com o usuário.

## Esboço do banco (migração `0005_shared_playlists.sql`, aplicada à mão no SQL Editor como as anteriores)

```sql
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40)
);

create table public.shared_playlists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shared_playlist_members (
  playlist_id uuid not null references public.shared_playlists (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'editor')),  -- 'viewer' só se pedirem
  joined_at   timestamptz not null default now(),
  primary key (playlist_id, user_id)
);

create table public.shared_playlist_tracks (
  playlist_id uuid not null references public.shared_playlists (id) on delete cascade,
  track_id    text not null check (char_length(track_id) between 1 and 64),
  track       jsonb not null check (pg_column_size(track) <= 8192 and (track ->> 'id') = track_id),
  position    double precision not null,
  added_by    uuid references auth.users (id) on delete set null,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

create table public.shared_playlist_invites (
  code        text primary key,                      -- 8 caracteres, sem ambiguidade (sem 0/O, 1/l)
  playlist_id uuid not null references public.shared_playlists (id) on delete cascade,
  created_by  uuid not null references auth.users (id) on delete cascade,
  expires_at  timestamptz not null,
  uses_left   integer not null check (uses_left >= 0)
);
```

**RLS** (sempre com `(select auth.uid())`, como nas políticas atuais):

- Funções `security definer` com `search_path` fixo, `is_member(playlist_id)` e `is_editor(playlist_id)`, para as políticas não recursarem na própria tabela de membros.
- `shared_playlists`: membros leem; só o dono altera e apaga.
- `shared_playlist_tracks`: membros leem; **editores** inserem, alteram `position` e apagam; `added_by` só pode ser o próprio usuário no insert (gatilho).
- `shared_playlist_members`: membros leem a lista de membros; o dono apaga membros; qualquer um apaga a própria linha (sair); **ninguém insere direto**.
- `profiles`: cada pessoa grava a própria; lê quem divide alguma playlist com ela.
- `shared_playlist_invites`: só o dono cria e lê. **Entrar por código** é uma função `security definer` `join_shared_playlist(code)` (valida validade e usos e insere o membro numa transação). O código nunca é consultado direto pelo cliente.
- Gatilhos de limite, como os de hoje: 20 playlists compartilhadas por pessoa, 10 membros por lista, 500 faixas por lista, convites ativos por lista limitados.

## Sincronização e conflitos

- Caminho novo `sharedPlaylistsSync`, separado do `UserDataSync`, no mesmo estilo de `podcastProgressSync`: leitura da lista inteira ao abrir a playlist e ao voltar ao primeiro plano (a mesma janela de 30 s), e operações pequenas (adicionar, remover, mover, renomear) enviadas na hora, com **fila local** para quando não há rede.
- Cada operação é idempotente por faixa; a posição fracionária é calculada no cliente a partir dos vizinhos que ele vê. Operação recusada pelo RLS (foi removido, limite) desfaz a mudança local e avisa uma vez.
- **Tempo real é opcional e fica para depois.** 📖 O Supabase tem Realtime sobre mudanças do Postgres, mas 💭 um PWA no iPhone perde a conexão ao sair do app (a página congela quando nada toca, medido no T32), então ele só ajudaria com o app aberto. A primeira versão atualiza ao abrir e ao voltar; Realtime só se o grupo sentir falta.
- Sem a migração, o app segue funcionando e a opção de compartilhar some (como `podcastsMissing` nos podcasts); `/api/health?deep=1` avisa com um id novo (`migrations-shared-playlists`, nível aviso).

## Interface (a validar num esboço visual antes de implementar, como foi feito com os podcasts)

- Biblioteca > Playlists: uma playlist compartilhada tem o ícone de pessoas e o número de membros.
- No menu da playlist pessoal: "Compartilhar com outras pessoas" (copia para uma lista compartilhada e abre o convite).
- Tela da playlist compartilhada: cabeçalho com os nomes dos membros, "Convidar" (gera o código e o copia), "Sair da playlist"; cada faixa mostra "adicionada por <nome>"; reordenar pela alça, como na fila (INV-UI-12).
- Entrar: em Biblioteca, "Entrar com código", campo de 8 caracteres.
- "Adicionar à playlist" (a folha atual) lista as pessoais e as compartilhadas em que a pessoa é editora.
- Nada de botão de reproduzir manual nem texto de carregamento (decisão do usuário): a reprodução é a de qualquer playlist.

## Reprodução e cota

- Tocar uma playlist compartilhada é tocar uma lista de faixas como outra qualquer (`playTrack` com a lista). 🔎 A cota diária de **faixas novas** é de cada pessoa que toca, e o cache de vídeos é compartilhado: a primeira pessoa que toca uma faixa nova paga a busca, as outras reaproveitam. Uma playlist com muitas faixas nunca tocadas pode estourar a cota de quem a abre; a pré-resolução (`prefetchResolved`, em lote, que nunca gasta cota) já cobre o caso das conhecidas.
- O limite do YouTube em segundo plano no app instalado vale igual: nada muda para as faixas compartilhadas (T32).

## Privacidade e segurança

- E-mail e id da conta nunca aparecem para outra pessoa: só o nome de exibição. Logs seguem sem e-mail (INV-OBS); o `uid` já é aceito nos logs por decisão do usuário.
- O código de convite é um segredo de baixa duração: 8 caracteres aleatórios, validade curta (por exemplo 7 dias) e usos limitados. 💭 Tentativas de adivinhar o código ficam limitadas pelo limite de taxa da chamada (`guard`), e `join_shared_playlist` registra recusa sem expor o motivo exato.
- A lista de membros e as faixas só saem para membros (RLS); testes de banco com **dois e três usuários** precisam provar que um estranho não lê nada.
- O dono pode remover um membro a qualquer hora; o convite pode ser revogado.

## Testes e invariantes propostos

Ids provisórios: viram `INV-…` no master [Contas e dados](../../masters/accounts-and-data.md) quando houver implementação.

- `INV-COLAB-01` (banco, PGlite com 3 usuários): só membros leem a lista e as faixas; só editores escrevem; ninguém insere membro direto; o código expirado ou sem usos não entra.
- `INV-COLAB-02` (unitário): a posição fracionária mantém a ordem sob inserções e movimentos concorrentes simulados e converge com o desempate.
- `INV-COLAB-03` (unitário): a fila local reenvia a operação sem duplicar e descarta a recusada pelo RLS.
- `INV-COLAB-04` (e2e, dois aparelhos com contas diferentes): uma pessoa cria e convida, a outra entra pelo código, ambas adicionam e veem a mesma ordem e o "adicionada por".
- `INV-COLAB-05`: nenhum e-mail chega ao cliente nem aos logs por causa da funcionalidade.
- O mock de login dos testes e2e (`tests/e2e/supabaseMock.ts`) hoje cria uma conta por teste; precisará **compartilhar dados entre duas contas** no mesmo teste.

## Fases sugeridas

1. **Banco e testes** (migração `0005`, RLS, gatilhos, `join_shared_playlist`), sem interface.
2. **Cliente: ler e tocar** uma lista compartilhada (entrar por código, ver membros, tocar).
3. **Cliente: escrever** (adicionar, remover, reordenar, renomear, fila local) e o nome de exibição em Ajustes.
4. **Compartilhar uma playlist pessoal** (cópia) e a interface de convite.
5. Opcional: Realtime e um diretório de pessoas, se fizer falta.

## Riscos e perguntas abertas

| Pergunta ou risco | Recomendação |
| --- | --- |
| Convite por código ou diretório de pessoas | Código; diretório só se o grupo crescer |
| Dono sai: passa ao editor mais antigo ou apaga | Passar ao editor mais antigo; confirmar com o usuário |
| Existe papel de leitor | Só se alguém pedir |
| Quantas playlists compartilhadas e membros por lista | 20 por pessoa e 10 por lista (a ajustar) |
| A lista inteira a cada abertura cabe no tamanho real | 💭 Sim para centenas de faixas; **medir** com uma lista de 500 faixas antes de decidir leitura incremental |
| Concorrência de movimentos produz ordem estranha | Posição fracionária com desempate; testar com simulação |
| Aplicar a migração à mão no Supabase | Já é o fluxo das migrações `0001` a `0004`; o app tolera a falta |
| Custo no plano gratuito do Supabase | 💭 Texto pequeno e poucas pessoas; conferir os limites oficiais antes de ligar (não verificados aqui) |
| Os dois caminhos de sincronização (instantâneo e por operação) convivem | Sim, porque as tabelas são separadas; o instantâneo continua só com as playlists pessoais |
