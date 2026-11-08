import React, { useEffect, useState } from 'react';
import { fetchAdminOverview, type AdminOverview } from '../utils/adminClient';

const LEVEL_LABEL = { ok: 'OK', warn: 'Aviso', error: 'Erro' } as const;

const Row: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({ label, value, testId }) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3 text-[15px]">
    <span className="text-label">{label}</span>
    <span className="text-right text-label-secondary" data-testid={testId}>{value}</span>
  </div>
);

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="space-y-1.5">
    <h3 className="px-4 text-[13px] uppercase tracking-wide text-label-secondary">{title}</h3>
    <div className="divide-y divide-separator overflow-hidden rounded-card bg-elevated">{children}</div>
  </section>
);

/** Private panel for the administrator: the YouTube search, who uses the quota, the shared cache and the configuration. */
export const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    void fetchAdminOverview(controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setData(value);
      setFailed(value === null);
    });
    return () => controller.abort();
  }, [reload]);

  return (
    <div
      role="dialog"
      aria-label="Administração"
      className="fixed inset-0 z-[60] overflow-y-auto bg-canvas animate-in fade-in"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto max-w-xl space-y-6 px-4 pb-10 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[34px] font-bold leading-10 text-label">Administração</h2>
          <button onClick={onClose} aria-label="Fechar administração" className="rounded-full bg-fill-tertiary px-4 py-1.5 text-[15px] font-semibold text-accent">
            OK
          </button>
        </div>

        {failed && (
          <p className="rounded-card bg-elevated px-4 py-3 text-[15px] text-label-secondary">
            Não foi possível carregar.{' '}
            <button onClick={() => setReload((n) => n + 1)} className="text-accent">Tentar de novo</button>
          </p>
        )}
        {!data && !failed && <p className="px-4 text-[15px] text-label-secondary">Carregando…</p>}

        {data && (
          <>
            <Block title="Busca do YouTube">
              <Row
                label="Busca oficial"
                testId="admin-youtube"
                value={data.youtube.search === 'normal' ? 'Normal' : `Suspensa (${data.youtube.reason ?? 'cota'}) até ${data.youtube.until ? new Date(data.youtube.until).toLocaleString('pt-BR') : '—'}`}
              />
              <Row label={`Buscas de hoje (${data.day})`} value={data.youtube.searchesToday} testId="admin-searches" />
              <Row label="Cota usada, no máximo" value={`${data.youtube.unitsUpperBound} de 10.000`} />
              <Row label="Limite por pessoa" value={`${data.limits.dailyNewTracks} faixas novas por dia`} />
            </Block>

            <Block title="Uso por pessoa">
              <Row label="Contas" value={data.people.accounts ?? '—'} />
              {data.people.perPerson.length === 0 && <Row label="Ninguém trouxe faixas novas hoje" value="" />}
              {data.people.perPerson.map((person) => (
                <Row key={person.email} label={person.email} value={`${person.used} de ${data.limits.dailyNewTracks}`} />
              ))}
            </Block>

            <Block title="Frequência e Usuários Ativos">
              {data.activity?.dailyCounts && data.activity.dailyCounts.length > 0 && (
                <div className="p-4 space-y-2 border-b border-separator/40">
                  <div className="flex items-center justify-between text-xs text-label-secondary">
                    <span>Usuários ativos por dia (últimos 14 dias)</span>
                    <span className="font-semibold text-accent">{data.activity.today}</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-20 pt-2 pb-1" data-testid="admin-activity-chart">
                    {(() => {
                      const max = Math.max(...data.activity.dailyCounts.map((d) => d.count), 1);
                      return data.activity.dailyCounts.map((item) => {
                      const heightPercent = item.count > 0 ? Math.max(15, Math.round((item.count / max) * 100)) : 6;
                      const dayLabel = item.day.slice(8); // DD
                      const isToday = item.day === data.activity?.today;

                      return (
                        <div key={item.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="w-full flex items-end justify-center h-14">
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={`w-full max-w-[16px] rounded-t transition-all ${
                                isToday
                                  ? 'bg-accent'
                                  : item.count > 0
                                  ? 'bg-accent/70'
                                  : 'bg-fill-tertiary'
                              }`}
                              title={`${item.day}: ${item.count} usuário(s)`}
                            />
                          </div>
                          <span className={`text-[10px] tabular-nums ${isToday ? 'text-accent font-bold' : 'text-label-tertiary'}`}>
                            {dayLabel}
                          </span>
                        </div>
                      );
                      });
                    })()}
                  </div>
                </div>
              )}

              {data.activity?.people == null ? (
                <Row label="Dados" value="ainda não gravados (rode a migração 0005_app_days.sql no Supabase)" testId="admin-activity-empty" />
              ) : data.activity.people.length === 0 ? (
                <Row label="Ninguém abriu o app nos últimos 30 dias" value="" />
              ) : (
                data.activity.people.map((person) => {
                  const freq =
                    person.days7 >= 5
                      ? { label: 'Diário', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
                      : person.days7 >= 2
                      ? { label: 'Frequente', bg: 'bg-accent/10 text-accent border-accent/20' }
                      : { label: 'Ocasional', bg: 'bg-white/5 text-label-secondary border-white/10' };

                  return (
                    <div key={person.email} className="px-4 py-3 space-y-1.5" data-testid="admin-activity-row">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-medium text-label truncate">{person.email}</span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${freq.bg}`}>
                          {freq.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[13px] text-label-secondary">
                        <span>
                          {person.days7}/7 dias na semana · {person.days30}/{data.activity?.window ?? 30} no mês
                        </span>
                        <span className="text-label-tertiary">
                          {person.streak > 1 ? `🔥 ${person.streak} dias seguidos` : `Último: ${person.last ?? '—'}`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </Block>

            <Block title="Cache compartilhado">
              <Row label="Faixas com vídeo guardado" value={data.cache.tracks ?? '—'} testId="admin-cache" />
            </Block>

            <Block title="Configuração">
              <Row label="Banco de dados" value={data.database === 'ok' ? 'Configurado' : 'Desligado'} />
              {data.config.filter((item) => item.level !== 'ok').length === 0 && <Row label="Verificações" value="Tudo certo" />}
              {data.config
                .filter((item) => item.level !== 'ok')
                .map((item) => (
                  <div key={item.id} className="px-4 py-3 text-[15px]">
                    <p className="text-label">{LEVEL_LABEL[item.level]}: {item.id}</p>
                    <p className="text-[13px] text-label-secondary">{item.message}</p>
                  </div>
                ))}
            </Block>
          </>
        )}
      </div>
    </div>
  );
};
