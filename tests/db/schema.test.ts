import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const USER_A = '00000000-0000-0000-0000-00000000000a';
const USER_B = '00000000-0000-0000-0000-00000000000b';

/** Minimal stand-ins for what Supabase provides: roles, auth.users and auth.uid(). */
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

let db: PGlite;

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(`insert into auth.users values ('${USER_A}'), ('${USER_B}')`);
});

after(async () => {
  await db.close();
});

const track = (id: string) => JSON.stringify({ id, title: `Track ${id}` });

/** Runs `fn` as the given role (and user) inside a transaction that is always rolled back. */
async function as<T>(role: 'anon' | 'authenticated' | 'service_role', user: string | null, fn: (q: PGlite) => Promise<T>) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user ?? '']);
    return await fn(db);
  } finally {
    await db.exec('rollback');
  }
}

async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (error: Error) => pattern.test(error.message));
}

test('favorites are isolated between users', async () => {
  await db.exec(`insert into favorites (user_id, track_id, track) values ('${USER_A}', '1', '${track('1')}')`);
  try {
    const own = await as('authenticated', USER_A, (q) => q.query('select track_id from favorites'));
    assert.equal(own.rows.length, 1);
    const other = await as('authenticated', USER_B, (q) => q.query('select track_id from favorites'));
    assert.equal(other.rows.length, 0);
  } finally {
    await db.exec('delete from favorites');
  }
});

test('a user cannot write rows for someone else', async () => {
  await rejects(
    as('authenticated', USER_A, (q) =>
      q.query(`insert into favorites (user_id, track_id, track) values ($1, '1', $2)`, [USER_B, track('1')])
    ),
    /row-level security/
  );
});

test('playlists and their tracks are private to the owner', async () => {
  await db.exec(`
    insert into playlists (id, user_id, name) values ('10000000-0000-0000-0000-000000000001', '${USER_A}', 'Mine');
    insert into playlist_tracks (playlist_id, track_id, track, position)
      values ('10000000-0000-0000-0000-000000000001', '1', '${track('1')}', 0);
  `);
  try {
    const seen = await as('authenticated', USER_B, async (q) => ({
      playlists: (await q.query('select 1 from playlists')).rows.length,
      tracks: (await q.query('select 1 from playlist_tracks')).rows.length,
    }));
    assert.deepEqual(seen, { playlists: 0, tracks: 0 });
    await rejects(
      as('authenticated', USER_B, (q) =>
        q.query(
          `insert into playlist_tracks (playlist_id, track_id, track, position)
           values ('10000000-0000-0000-0000-000000000001', '2', $1, 1)`,
          [track('2')]
        )
      ),
      /row-level security/
    );
  } finally {
    await db.exec('delete from playlists');
  }
});

test('anon has no access to user tables', async () => {
  await rejects(as('anon', null, (q) => q.query('select * from favorites')), /permission denied/);
});

test('rows must be well formed', async () => {
  await rejects(
    as('authenticated', USER_A, (q) =>
      q.query(`insert into video_choices (user_id, track_id, video_id) values ($1, '1', 'not a video')`, [USER_A])
    ),
    /video_choices/
  );
  await rejects(
    as('authenticated', USER_A, (q) =>
      q.query(`insert into favorites (user_id, track_id, track) values ($1, '1', $2)`, [USER_A, track('2')])
    ),
    /favorites/
  );
});

test('limits: 100 playlists per user and 500 tracks per playlist', async () => {
  await db.exec(`insert into playlists (user_id, name) select '${USER_A}', 'p' || g from generate_series(1, 100) g`);
  try {
    await rejects(
      as('authenticated', USER_A, (q) => q.query(`insert into playlists (user_id, name) values ($1, 'one more')`, [USER_A])),
      /./
    );
    await db.exec(`insert into playlists (user_id, name) values ('${USER_B}', 'fine')`);
  } finally {
    await db.exec('delete from playlists');
  }

  await db.exec(`insert into playlists (id, user_id, name) values ('10000000-0000-0000-0000-000000000002', '${USER_A}', 'Big')`);
  try {
    await db.exec(`
      insert into playlist_tracks (playlist_id, track_id, track, position)
      select '10000000-0000-0000-0000-000000000002', g::text, json_build_object('id', g::text)::jsonb, g
      from generate_series(1, 500) g
    `);
    await rejects(
      db.query(
        `insert into playlist_tracks (playlist_id, track_id, track, position)
         values ('10000000-0000-0000-0000-000000000002', 'x', '{"id":"x"}', 501)`
      ),
      /./
    );
  } finally {
    await db.exec('delete from playlists');
  }
});

test('play history keeps only the 500 most recent entries', async () => {
  try {
    await db.exec(`
      insert into play_history (user_id, track_id, track, played_at)
      select '${USER_A}', g::text, json_build_object('id', g::text)::jsonb, now() - (600 - g) * interval '1 minute'
      from generate_series(1, 520) g
    `);
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from play_history where user_id = '${USER_A}'`);
    assert.equal(rows[0].n, 500);
  } finally {
    await db.exec('delete from play_history');
  }
});

test('video_cache is only reachable by the server', async () => {
  await rejects(as('authenticated', USER_A, (q) => q.query('select * from video_cache')), /permission denied/);
  await as('service_role', null, async (q) => {
    await q.query(`insert into video_cache (track_id, video_ids) values ('1', array['abcdefghijk'])`);
    const { rows } = await q.query('select video_ids from video_cache');
    assert.equal(rows.length, 1);
  });
});

test('consume_resolve counts per user, stops at the limit and is server-only', async () => {
  await rejects(as('authenticated', USER_A, (q) => q.query(`select consume_resolve($1, 3)`, [USER_A])), /permission denied/);

  await db.exec(`set role service_role`);
  try {
    const call = async (user: string) =>
      (await db.query<{ n: number }>(`select consume_resolve($1, 3) as n`, [user])).rows[0].n;
    assert.deepEqual([await call(USER_A), await call(USER_A), await call(USER_A)], [1, 2, 3]);
    assert.equal(await call(USER_A), -1);
    assert.equal(await call(USER_B), 1);
  } finally {
    await db.exec('reset role');
    await db.exec('delete from usage_daily');
  }
});

test('usage_daily is read-only for its owner', async () => {
  await db.exec(`insert into usage_daily (user_id, day, resolves) values ('${USER_A}', current_date, 4), ('${USER_B}', current_date, 1)`);
  try {
    const own = await as('authenticated', USER_A, (q) => q.query<{ resolves: number }>('select resolves from usage_daily'));
    assert.deepEqual(own.rows.map((row) => row.resolves), [4]);
    await rejects(
      as('authenticated', USER_A, (q) => q.query(`update usage_daily set resolves = 0`)),
      /permission denied/
    );
  } finally {
    await db.exec('delete from usage_daily');
  }
});

test('video_cache aceita "não achei" (lista vazia) mas não mais de 5 vídeos', async () => {
  await as('service_role', null, async (q) => {
    await q.query(`insert into video_cache (track_id, video_ids) values ('deezer-1', '{}')`);
    await rejects(q.query(`insert into video_cache (track_id, video_ids) values ('deezer-2', array['a','b','c','d','e','f'])`), /video_cache/);
  });
});

test('refund_resolve devolve uma unidade da cota do dia, sem passar de zero, e é só do servidor', async () => {
  await rejects(as('authenticated', USER_A, (q) => q.query(`select refund_resolve($1)`, [USER_A])), /permission denied/);

  await db.exec(`set role service_role`);
  try {
    const used = async (user: string) =>
      (await db.query<{ resolves: number }>(`select resolves from usage_daily where user_id = $1`, [user])).rows[0]?.resolves;
    await db.query(`select consume_resolve($1, 5)`, [USER_A]);
    await db.query(`select consume_resolve($1, 5)`, [USER_A]);
    await db.query(`select refund_resolve($1)`, [USER_A]);
    assert.equal(await used(USER_A), 1);
    await db.query(`select refund_resolve($1)`, [USER_A]);
    await db.query(`select refund_resolve($1)`, [USER_A]);
    assert.equal(await used(USER_A), 0);
  } finally {
    await db.exec('reset role');
    await db.exec('delete from usage_daily');
  }
});


test('INV-PLAY-15: service_state (o disjuntor da busca do YouTube) só o servidor lê e escreve; app e anônimo não enxergam nada', async () => {
  await as('service_role', null, async (q) => {
    await q.exec(`insert into public.service_state (key, until, reason) values ('youtube_api', now() + interval '6 hours', 'quota')
                  on conflict (key) do update set until = excluded.until`);
    const rows = await q.query<{ reason: string }>(`select reason from public.service_state where key = 'youtube_api'`);
    assert.equal(rows.rows[0].reason, 'quota');
  });
  await as('authenticated', USER_A, async (q) => {
    await assert.rejects(() => q.query('select * from public.service_state'), /permission denied/);
  });
  await as('anon', null, async (q) => {
    await assert.rejects(() => q.query('select * from public.service_state'), /permission denied/);
  });
});
