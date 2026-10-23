import React, { useState, useEffect, useCallback } from 'react';
import { Database, Trash2, HardDrive, Settings, X, Check, RefreshCw } from 'lucide-react';

const CACHE_SIZE_KEY = 'aurastream_cache_limit_mb';
const DEFAULT_CACHE_LIMIT_MB = 250; // 250 MB default quota

export const CacheSettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const [selectedLimit, setSelectedLimit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CACHE_SIZE_KEY);
      return saved ? parseInt(saved, 10) : DEFAULT_CACHE_LIMIT_MB;
    } catch {
      return DEFAULT_CACHE_LIMIT_MB;
    }
  });

  const [cacheStats, setCacheStats] = useState<{ count: number; estimatedSizeMB: string }>({
    count: 0,
    estimatedSizeMB: '0.0'
  });
  const [isClearing, setIsClearing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate actual cache usage from browser CacheStorage
  const calculateCacheUsage = useCallback(async () => {
    try {
      if (!('caches' in window)) return;
      const keys = await caches.keys();
      let totalBytes = 0;
      let totalFiles = 0;

      for (const key of keys) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        totalFiles += requests.length;
        for (const req of requests) {
          const res = await cache.match(req);
          if (res) {
            const blob = await res.blob();
            totalBytes += blob.size;
          }
        }
      }

      const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);
      setCacheStats({
        count: totalFiles,
        estimatedSizeMB: sizeMB
      });
    } catch (e) {
      console.warn('Could not compute cache size:', e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      calculateCacheUsage();
    }
  }, [isOpen, calculateCacheUsage]);

  const handleSaveLimit = (limit: number) => {
    setSelectedLimit(limit);
    try {
      localStorage.setItem(CACHE_SIZE_KEY, limit.toString());
      setSuccessMessage('Cota de cache atualizada com sucesso!');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch {}
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      localStorage.removeItem('aurastream_liked_tracks');
      await calculateCacheUsage();
      setSuccessMessage('Cache local limpo e redefinido com sucesso!');
      setTimeout(() => {
        setSuccessMessage(null);
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  const quotas = [
    { label: '50 MB (Econômico)', value: 50 },
    { label: '150 MB (Moderado)', value: 150 },
    { label: '250 MB (Padrão)', value: 250 },
    { label: '500 MB (Avançado)', value: 500 },
    { label: '1 GB (Ilimitado / Offline)', value: 1024 }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-3xl bg-[#10101b] border border-white/10 p-5 shadow-2xl text-left text-white max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Gerenciamento de Cache</h3>
              <p className="text-[11px] text-white/50">Controle de espaço de armazenamento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar configurações de cache"
            className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Usage Card */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              Uso Atual no Aparelho
            </span>
            <span className="font-mono text-purple-400 font-semibold">
              {cacheStats.estimatedSizeMB} MB ({cacheStats.count} arquivos)
            </span>
          </div>
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (parseFloat(cacheStats.estimatedSizeMB) / selectedLimit) * 100)}%`
              }}
            />
          </div>
          <span className="text-[10px] text-white/40 block text-right">
            Limite configurado: {selectedLimit >= 1024 ? '1 GB' : `${selectedLimit} MB`}
          </span>
        </div>

        {/* Success Feedback Alert */}
        {successMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Quota Selection Options */}
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-white/50 block">
            ESCOLHER COTA MÁXIMA DE ARMAZENAMENTO
          </span>
          <div className="space-y-1.5">
            {quotas.map((q) => {
              const isSelected = selectedLimit === q.value;
              return (
                <button
                  key={q.value}
                  onClick={() => handleSaveLimit(q.value)}
                  className={`w-full p-2.5 rounded-2xl flex items-center justify-between border text-xs transition-all ${
                    isSelected
                      ? 'bg-purple-600/30 border-purple-500 text-white font-semibold'
                      : 'bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.05]'
                  }`}
                >
                  <span>{q.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clear Cache Action */}
        <div className="pt-2 border-t border-white/15 space-y-2">
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className="w-full py-2.5 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-medium text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {isClearing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Limpar Todo o Cache & Reiniciar</span>
          </button>
          <p className="text-[10px] text-white/40 text-center">
            Remove capas em cache, Service Worker offline e libera espaço no seu dispositivo.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs active:scale-[0.98] transition-transform"
        >
          Concluído
        </button>
      </div>
    </div>
  );
};
