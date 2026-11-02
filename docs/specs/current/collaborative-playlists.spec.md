# Especificação: playlists colaborativas (esboço revisado)

Status: **esboço para decisão, nada implementado**. Primeira versão em 2026-11-02; **revisada no mesmo dia com as decisões do usuário** (seção abaixo). Pertence ao master [Contas e dados](../../masters/accounts-and-data.md). Rótulos de evidência: 🔎 lido no código deste repositório; 📖 fonte externa; 💭 hipótese ou estimativa minha, não medida.

## Objetivo

Uma pessoa registrada no app transforma uma playlist sua em **colaborativa com mais uma pessoa**, também registrada. Depois que a convidada aceita, as duas adicionam, removem e reordenam faixas na mesma lista e veem quem adicionou cada faixa.

## Decisões do usuário (2026-11-02)

| # | Decisão |
| --- | --- |
| 1 | O convite é por **busca e lista de pessoas dentro do app** (não por código). |
| 2 | A pessoa convidada **precisa aceitar** o convite. |
| 3 | A funcionalidade fica **bloqueada até haver notificações** dentro do app (push talvez depois). Ver a seção "Notificações" abaixo: a proposta é que a caixa de avisos dentro do app seja o desbloqueio, e o push venha depois. |
| 4 | Quem cria a playlist **não pode sair dela**. Pode **excluí-la**, o que desfaz o vínculo para as duas pessoas, e pode **remover a convidada**. |
| 5 | É **uma pessoa a mais**, nunca um grupo: no máximo duas participantes por playlist. |
| 6 | O limite é de **10 playlists colaborativas**. A pessoa vê o limite ao tentar convidar alguém, no momento de tornar uma playlist colaborativa. |
| 7 | Nada será implementado agora: só a spec, com uma proposta de interface e as lacunas a decidir. |

## Fora de escopo (por enquanto)

- Grupos com mais de duas pessoas, papel de leitor, links ou códigos de convite.
- Ouvir junto em tempo real (sincronizar a reprodução entre aparelhos).
- Convidar quem não tem conta (o app é fechado por convite do administrador, INV-AUTH).
- Comentários, curtidas e perfis públicos.
- Offline de faixa: descartado em definitivo ([decisões de áudio](audio-sources-decisions.spec.md)).

## O que existe hoje (e o que isso impõe)

- 🔎 Playlists são **por usuário**: `playlists` (dono `user_id`, nome de 1 a 60 caracteres) e `playlist_tracks` (chave `(playlist_id, track_id)`, `track` em jsonb de até 8 KB, `position` inteiro) em `supabase/migrations/0001_init.sql`. O RLS é "só o dono". Gatilhos: 100 playlists por usuário, 500 faixas por playlist.
- 🔎 O cliente sincroniza as playlists como **um instantâneo da conta** (`UserDataSnapshot`, `src/utils/userData.ts`): envia a diferença entre o antes e o depois e, ao abrir ou voltar ao primeiro plano (no máximo a cada 30 s, `SyncAgent`), lê tudo e junta com o local. Não há Realtime.
- 🔎 Toda chamada ao Supabase usa o token da pessoa com RLS (`createRestCaller`). Não existe perfil nem nome de exibição: o banco só tem `auth.users`, e o e-mail nunca vai ao cliente nem ao log (INV-OBS).
- 🔎 Na tela da playlist (`LibraryScreen`) há hoje três ações: Tocar, Renomear (lápis) e Apagar (lixeira). Na Biblioteca, a linha "Playlists" abre a lista, e "Adicionar à playlist" é uma folha (`AddToPlaylistSheet`).
- 🔎 Não existe nenhum mecanismo de **aviso para outra pessoa**: nada além dos dados da própria conta.

## Estados de uma playlist

```text
Pessoal --(Convidar)--> Convite pendente --(aceita)--> Colaborativa
   ^                          |                              |
   |<---(cancelar / recusar / expirar)                       |-- dona remove a convidada --> volta a "só da dona"*
   |                                                         |-- convidada sai ----------> volta a "só da dona"*
   |                                                         '-- dona exclui -------------> some para as duas
```

\* O que acontece com a playlist quando ela volta a "só da dona" é a lacuna **L2** abaixo: pessoal, ou colaborativa sem convidada.

## Fluxo

**Dona (quem cria):**
1. Abre uma playlist pessoal, toca em **Colaborar** (novo botão ao lado de Renomear e Apagar).
2. Vê a folha "Convidar para colaborar": o contador de limite no topo ("3 de 10 playlists colaborativas"), a busca de pessoas e a lista.
3. Escolhe uma pessoa e confirma. O convite fica **pendente** e a playlist mostra "Convite enviado a Ana · aguardando".
4. Pode **cancelar o convite** enquanto estiver pendente. Depois de aceito, pode **remover a convidada** ou **excluir a playlist**; não pode sair.

**Convidada:**
1. Ao abrir o app vê o aviso de convite (ver "Notificações"): quem convidou, o nome da playlist e quantas faixas tem.
2. **Aceita** (a playlist aparece na lista dela, com o ícone de colaborativa) ou **recusa** (a dona é avisada).
3. Depois de aceita, pode editar as faixas e **sair** (lacuna **L5**: o usuário ainda não decidiu se a convidada pode sair; a recomendação é que sim).

## Notificações (a dependência que bloqueia a funcionalidade)

O convite precisa chegar à convidada, e hoje o app não tem como avisar uma pessoa de algo que outra fez.

- **Proposta: dois níveis.** (1) **Avisos dentro do app**: uma caixa de avisos que a pessoa vê quando abre o app, com contador na aba Biblioteca e uma linha "Avisos" no topo da Biblioteca. Para 3 a 5 pessoas isso já cumpre o papel de "notificação" do convite e **desbloqueia a funcionalidade** sem esperar o push. (2) **Push** (aviso no aparelho com o app fechado) vem depois, como melhoria.
- **Banco:** uma tabela genérica `user_notifications` (`id`, `user_id`, `kind`, `payload` jsonb, `created_at`, `read_at`), com RLS "só a dona lê e marca como lida" e gravação só por funções do servidor (`security definer`), nunca direto pelo cliente. Serve ao convite e a qualquer aviso futuro (episódio novo de podcast, por exemplo).
- **Eventos que geram aviso** (proposta): convite recebido, convite aceito, convite recusado, convite cancelado, convidada removida, convidada saiu, playlist excluída pela dona.
- **Push (depois):** 📖 o Web Push funciona em apps da tela inicial do iOS 16.4 ou mais novo, só depois de instalado e com um toque da pessoa autorizando, e há relatos de assinaturas que somem ([fontes na descoberta de funcionalidades](feature-discovery.spec.md), item D11). Exige chave VAPID, uma tabela de assinaturas, um service worker que recebe o push e um envio pelo servidor; 🔎 hoje são 9 das 12 funções da Vercel usadas, então cabe, de preferência dentro de uma rota existente. O plano gratuito da Vercel só permite tarefa agendada uma vez por dia (📖 conferido na descoberta), o que não atrapalha: o push sai no momento do evento, não por agendamento.
- **Sem a caixa de avisos não há como a convidada saber do convite**: por isso ela vem antes de qualquer outra fase.

## Banco (esboço da migração `0005`, aplicada à mão no SQL Editor como as anteriores)

Com duas pessoas por playlist o modelo fica menor do que na primeira versão (sem tabela de membros nem códigos de convite):

```sql
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40)
  -- + índice único em lower(display_name) se os nomes tiverem de ser únicos (lacuna L3)
);

create table public.shared_playlists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  guest_id   uuid references auth.users (id) on delete set null,
  status     text not null check (status in ('pending', 'active')),  -- pending: convite enviado, ainda não aceito
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guest_id is distinct from owner_id)
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

create table public.user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
```

**Funções `security definer` (com `search_path` fixo)**, que são o único caminho para mudar o estado do convite e para gerar avisos:

- `invite_to_playlist(playlist, to_user)`: confere que a chamadora é a dona, que não há convidada nem convite pendente, o **limite de 10 de cada lado conforme a lacuna L1**, e grava o aviso à convidada.
- `respond_to_invite(playlist, accept)`: só a convidada; confere o limite dela ao aceitar; vira `active` ou desfaz; avisa a dona.
- `cancel_invite(playlist)`, `remove_guest(playlist)`, `leave_playlist(playlist)` (convidada) e a exclusão pela dona, cada uma gerando o aviso correspondente.

**RLS:** a dona lê e altera a própria playlist compartilhada; a convidada lê **só quando `status = 'active'`** (enquanto pendente ela só vê o convite no aviso, que já traz o nome e o número de faixas, não as faixas); as faixas seguem a mesma regra e **as duas participantes** inserem, movem e apagam faixas quando ativa, com `added_by` forçado ao próprio usuário por gatilho. `profiles`: cada pessoa grava o próprio; leitura conforme a lacuna **L3**. `user_notifications`: só a dona do aviso lê e marca como lido.

**Gatilhos de limite:** 10 playlists colaborativas por pessoa (como decidido; contagem na lacuna **L1**), 500 faixas por playlist, 10 convites por pessoa por dia (contra abuso).

## Sincronização

- 🔎 O instantâneo da conta **não serve** para a lista compartilhada: se os dois aparelhos o usassem para a mesma playlist, a diferença de um apagaria o que o outro acabou de adicionar, e "apagar" para a convidada teria de significar "sair", não "excluir". Por isso a lista compartilhada usa **tabelas separadas** e um caminho de sincronização **por operação** (adicionar, remover, mover, renomear), no estilo do histórico e da posição de podcasts (`playHistorySync`, `podcastProgressSync`), com fila local para operações sem rede. As playlists pessoais continuam no instantâneo, sem mudança. Esta escolha é a lacuna **L9**.
- Leitura da lista inteira ao abrir a playlist e ao voltar ao primeiro plano (a mesma janela de 30 s). Com duas pessoas, a **posição fracionária** com desempate por `added_at` e `track_id` basta; vale a última gravação por faixa e a ordem converge na próxima leitura.
- 💭 Realtime fica fora: o iPhone congela a página quando nada toca (T32), e a atualização ao abrir e ao voltar atende duas pessoas.
- Ações de convite (convidar, aceitar, recusar, remover) **exigem rede**: não entram na fila local.
- Sem a migração, o app segue funcionando e a opção de colaborar some (como `podcastsMissing`); `/api/health?deep=1` avisa com um id novo (`migrations-shared-playlists`, nível aviso).

## Limite de 10 e como mostrá-lo

O usuário quer que o limite apareça **ao tentar convidar**. Proposta: aparecer em três lugares, sempre no mesmo formato "N de 10 playlists colaborativas":

1. No topo da folha "Convidar para colaborar" (o lugar pedido).
2. Como legenda do botão Colaborar (quando restam poucas) e como motivo quando está desabilitado.
3. Na tela de Avisos, quando a convidada não pode aceitar por estar no limite dela.

Ao chegar a 10: o botão Colaborar abre a mesma folha, mas no lugar da busca mostra "Você já tem 10 playlists colaborativas. Exclua uma, ou peça para a outra pessoa remover você, para criar outra." com atalho para a lista das colaborativas.

## Interface proposta

Princípios: um caminho curto (três toques para convidar), o limite sempre visível quando importa, o estado da playlist legível de relance, e nenhuma ação destrutiva sem explicar o efeito para as **duas** pessoas. Seguir o design system atual: folhas de baixo com `--safe-bottom`, ícones do `lucide-react`, o mesmo estilo de `NameDialog` e da fila reordenável. **Esboço visual antes de implementar**, como foi feito com os podcasts.

**1. Tela da playlist, pessoal (hoje: Tocar, lápis, lixeira)**

```text
 ┌──────────────────────────────────┐
 │  [ ▶ Tocar ]   ✎    👥    🗑      │   ← novo: 👥 "Colaborar"
 │                                  │
 │  Faixa 1                         │
 └──────────────────────────────────┘
```

**2. Folha "Convidar para colaborar"** (abre de 👥; o limite no topo)

```text
 ┌──────────────────────────────────┐
 │  Convidar para colaborar      ✕  │
 │  3 de 10 playlists colaborativas │   ← o limite, como pedido
 │  ┌────────────────────────────┐  │
 │  │ 🔍 Buscar pessoa           │  │
 │  └────────────────────────────┘  │
 │   (A)  Ana                       │
 │   (B)  Bruno                     │
 │   (C)  Carla                     │
 │  Uma pessoa por playlist. Ela    │
 │  precisa aceitar o convite.      │
 └──────────────────────────────────┘
```

Tocar numa pessoa abre a confirmação: **"Convidar Ana para 'Treino'? Ela precisa aceitar. A playlist continua sua; se ela recusar, nada muda."** com os botões "Enviar convite" e "Cancelar".

**3. Tela da playlist, com convite pendente**

```text
 │  Treino                                  │
 │  ⏳ Convite enviado a Ana · aguardando    │
 │  [ ▶ Tocar ]  ✎  ✕ Cancelar convite  🗑  │
```

**4. Tela da playlist, colaborativa ativa**

```text
 │  Treino                          👥 com Ana │
 │  [ ▶ Tocar ]  ✎  ⋯                          │
 │   Faixa 1                       adicionada por Ana  │
 ⋯ (dona): "Remover Ana", "Excluir playlist"
 ⋯ (convidada): "Salvar uma cópia só minha", "Sair da playlist"
```

A dona não vê "Sair". Em "Excluir playlist" a confirmação explica: **"Isto apaga 'Treino' para você e para a Ana. Não dá para desfazer."** Em "Remover Ana": "Ana perde o acesso. As faixas ficam com você."

**5. Avisos (caixa dentro do app)**

```text
 Biblioteca (aba com contador ①)
 ┌──────────────────────────────────┐
 │ 🔔  Avisos                    ①  >│   ← linha nova no topo da Biblioteca
 │ ♫   Playlists                  7  >│
 └──────────────────────────────────┘

 Avisos:
 ┌──────────────────────────────────┐
 │ Bruno convidou você para         │
 │ "Treino" (24 faixas)             │
 │  [ Aceitar ]   [ Recusar ]       │
 ├──────────────────────────────────┤
 │ Ana aceitou o convite para       │
 │ "Treino"                      ✓  │
 └──────────────────────────────────┘
```

Um aviso novo também aparece como faixa discreta no topo do Início, enquanto não for lido, para quem não vai à Biblioteca.

**6. Lista de playlists:** as colaborativas ficam **na mesma lista**, com o ícone 👥 e o subtítulo "com Ana" (ou "convite pendente"); sem seção separada, porque são no máximo 10.

**Textos curtos** (Português, tom do app): "Colaborar", "Convidar para colaborar", "Convite enviado a <nome> · aguardando", "<nome> convidou você para <playlist>", "Aceitar", "Recusar", "Cancelar convite", "Remover <nome>", "Excluir playlist", "Sair da playlist", "Salvar uma cópia só minha", "<N> de 10 playlists colaborativas".

## Lacunas e decisões a tomar

Cada linha tem a **recomendação** que eu adotaria se o usuário concordar. "Decidida" são as que o usuário já fechou; as demais estão abertas.

| # | Lacuna | Recomendação |
| --- | --- | --- |
| L1 | **O limite de 10 conta o quê?** Só as que a pessoa criou, ou também as em que é convidada? Convites pendentes contam? | Contar **toda participação ativa** (como dona ou convidada) e os convites pendentes da dona: assim ninguém passa de 10 e o convite não vira um jeito de driblar o limite. A convidada confere o limite dela ao aceitar. |
| L2 | **O que acontece com a playlist ao recusar, cancelar, remover ou a convidada sair?** | Volta a ser **pessoal da dona** (sem convidada), saindo do limite. As faixas ficam com a dona. |
| L3 | **Diretório de pessoas: privacidade e nomes.** Todo registrado enxerga o nome de todos (é o que a busca por lista exige). Nomes repetidos ("Ana", "Ana")? Quem ainda não definiu o nome? | A busca lista **só nomes de exibição** (nunca e-mail); nomes **únicos sem diferenciar maiúsculas**; quem não tem nome definido não aparece. Num grupo fechado de 3 a 5 pessoas isso é aceitável, mas é uma mudança de privacidade a confirmar. |
| L4 | **Ciclo de vida do convite.** Validade, recusa, convites repetidos. | Um pendente por playlist; **expira em 30 dias** (aviso à dona); depois de recusado, a dona pode convidar de novo, com o limite de 10 convites por dia contra abuso. |
| L5 | **A convidada pode sair?** (O usuário só disse que a criadora não pode.) E o que ela leva ao sair ou ser removida? | **Pode sair.** Enquanto participa, "Salvar uma cópia só minha" cria uma playlist pessoal; depois de sair, removida ou da exclusão, ela não leva nada. A exclusão pela dona avisa as duas no diálogo. |
| L6 | **Permissões dentro da lista.** Quem renomeia e exclui? A convidada pode apagar faixas da dona? | Só a dona renomeia e exclui; as duas adicionam, movem e removem faixas, com um "desfazer" curto ao remover (como a fila). |
| L7 | **Quais eventos geram aviso** e por quanto tempo ficam. | Os sete listados em "Notificações"; mantidos por 90 dias; avisos de convite saem quando respondidos. |
| L8 | **Push.** Entra agora ou depois? Hoje o desbloqueio proposto é a caixa de avisos. | **Depois.** A caixa de avisos basta para duas pessoas; o push traz custo (chave, assinaturas, service worker, envio) e é instável no iPhone, e o usuário disse "talvez". |
| L9 | **Motor de sincronização: tabelas novas ou reaproveitar as playlists existentes.** Com só duas pessoas, reaproveitar parece mais barato, mas "apagar" na conta da convidada teria de virar "sair", e as posições inteiras colidem quando as duas adicionam ao mesmo tempo. | **Tabelas separadas**, pelos dois motivos ao lado; o instantâneo pessoal fica intocado. |
| L10 | **Converter ao convidar ou ao aceitar?** Mover a playlist para as tabelas compartilhadas já no convite (a dona edita normalmente enquanto espera) ou só quando a convidada aceita. | **Ao convidar**, feito pelo aparelho da dona com operações comuns (cria a lista compartilhada, apaga a pessoal); no pendente ela já existe só para a dona. Converter no aceite exigiria o servidor ler a lista pessoal da dona, o que o RLS proíbe, e a cópia no servidor pode recriar a playlist pessoal depois no instantâneo. |
| L11 | **Conta apagada pelo administrador.** | A playlist da dona some junto (cascata); se for a convidada, a lista volta à dona (L2). Aviso só se der tempo: 💭 sem garantia, porque o aviso depende da conta apagada. |
| L12 | **A mesma pessoa em vários aparelhos** vê o convite e o estado em todos? | Sim: os avisos e o estado vêm da conta, não do aparelho; as ações de convite exigem rede. |
| L13 | **Os dois ao mesmo tempo na mesma lista.** | Posição fracionária com desempate e leitura ao abrir e ao voltar; conflito raro com duas pessoas. Cobrir em teste com simulação. |

## Testes e invariantes propostos

Ids provisórios: viram `INV-…` no master [Contas e dados](../../masters/accounts-and-data.md) quando houver implementação.

- `INV-COLAB-01` (banco, PGlite com 3 usuários): só dona e convidada ativa leem a lista e as faixas; um terceiro não lê nada; a convidada pendente não lê as faixas; o limite de 10 vale conforme a L1; ninguém grava convite ou aviso direto.
- `INV-COLAB-02` (unitário): a posição fracionária mantém a ordem sob inserções e movimentos concorrentes e converge com o desempate.
- `INV-COLAB-03` (unitário): a fila local reenvia a operação de faixa sem duplicar e descarta a recusada pelo RLS; as ações de convite não entram na fila.
- `INV-COLAB-04` (e2e, duas contas no mesmo teste): a dona convida, a convidada vê o aviso, aceita, as duas adicionam e veem a mesma ordem e o "adicionada por"; a dona não vê "Sair"; excluir some para as duas.
- `INV-COLAB-05`: o limite aparece na folha de convite ("N de 10 playlists colaborativas") e, no limite, impede o convite com o texto de motivo.
- `INV-COLAB-06`: nenhum e-mail chega ao cliente nem aos logs por causa da funcionalidade.
- O mock de login dos e2e (`tests/e2e/supabaseMock.ts`) hoje cria uma conta por teste; precisará **compartilhar dados entre duas contas** no mesmo teste.

## Fases sugeridas

0. **Caixa de avisos dentro do app** (`user_notifications`, tela Avisos, contador, aviso no Início). Vale por si só e desbloqueia o resto.
1. **Banco e testes** da colaboração (migração `0005`, RLS, funções, gatilhos), sem interface.
2. **Nome de exibição** em Ajustes e a busca de pessoas.
3. **Convidar, aceitar e recusar**, com o estado pendente.
4. **Editar em conjunto** (adicionar, remover, mover, "adicionada por", fila local).
5. **Remover convidada, sair, excluir**, "Salvar uma cópia só minha".
6. Depois, opcional: push.

## Riscos

| Risco | Tratamento |
| --- | --- |
| A mudança de privacidade (todos veem a lista de nomes) | Decidir na L3 e documentar no master |
| O instantâneo pessoal recriar uma playlist já movida para o compartilhado | Mover pelo aparelho da dona com operações comuns (L10) e teste de dois aparelhos da mesma conta |
| Convite que nunca é visto porque a pessoa não abre o app | Expira em 30 dias (L4); o push resolve depois (L8) |
| Aplicar a migração à mão no Supabase | É o fluxo das migrações `0001` a `0004`; o app tolera a falta |
| Custo no plano gratuito do Supabase | 💭 Texto pequeno e duas pessoas por lista; conferir os limites oficiais antes de ligar (não verificados aqui) |
