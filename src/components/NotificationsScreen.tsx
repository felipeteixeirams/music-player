import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { noticeBody, noticeTitle } from '../utils/notifications';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The notice box (INV-NOT-02): what came since the last visit is marked "Novo" while the screen is open, and everything
 * is marked as read as soon as the screen opens. Without the table in the database it says so, and the app goes on.
 */
export const NotificationsScreen: React.FC = () => {
  const { notices, status, markAllRead } = useNotifications();
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    if (status !== 'ready' || captured) return;
    setCaptured(true);
    setFresh(new Set(notices.filter((notice) => notice.readAt === null).map((notice) => notice.id)));
    void markAllRead();
  }, [status, notices, captured, markAllRead]);

  if (status === 'loading') {
    return <p className="px-4 py-10 text-center text-[15px] text-label-secondary">Carregando avisos…</p>;
  }

  if (status === 'unavailable') {
    return (
      <div className="px-4 py-10 text-center space-y-2">
        <p className="text-[17px] font-semibold text-label">Avisos indisponíveis</p>
        <p className="text-[14px] text-label-secondary">Não foi possível ler seus avisos agora. Tente de novo em instantes.</p>
      </div>
    );
  }

  if (notices.length === 0) {
    return (
      <div className="px-4 py-10 text-center space-y-2">
        <Bell className="mx-auto h-8 w-8 text-label-tertiary" aria-hidden="true" />
        <p className="text-[15px] text-label-secondary">Nenhum aviso por enquanto.</p>
      </div>
    );
  }

  return (
    <ul className="px-4 py-2 space-y-2" aria-label="Avisos">
      {notices.map((notice) => (
        <li key={notice.id} className="rounded-card bg-fill-tertiary px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold text-label">{noticeTitle(notice)}</p>
              {noticeBody(notice) && <p className="mt-0.5 text-[14px] text-label-secondary">{noticeBody(notice)}</p>}
              <p className="mt-1 text-[12px] text-label-tertiary">{dateFormat.format(new Date(notice.createdAt))}</p>
            </div>
            {fresh.has(notice.id) && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">Novo</span>}
          </div>
        </li>
      ))}
    </ul>
  );
};
