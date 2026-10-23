import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed as PWA standalone, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        aria-label="Instalar AuraStream no celular"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 backdrop-blur-md border border-white/10 active:scale-95 transition-all whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          aria-label="Instalar no iPhone"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/90 text-xs font-semibold backdrop-blur-md border border-white/10 active:scale-95 transition-all whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-purple-400" />
          <span>Instalar no iOS</span>
        </button>

        {showIOSModal &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
            >
            <div className="w-full max-w-sm rounded-3xl bg-[#12121d] border border-white/10 p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                    A
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Instalar no iPhone / iPad</h3>
                    <p className="text-[11px] text-white/50">Experiência nativa em tela cheia</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  aria-label="Fechar instruções"
                  className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-white/80">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                    1
                  </div>
                  <p>
                    No Safari, toque no botão <strong className="text-white">Compartilhar</strong> (ícone{' '}
                    <Share className="inline w-3.5 h-3.5 text-purple-400" /> na barra inferior).
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                    2
                  </div>
                  <p>
                    Role para baixo e selecione <strong className="text-white">Adicionar à Tela de Início</strong>{' '}
                    (<PlusSquare className="inline w-3.5 h-3.5 text-purple-400" />).
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                    3
                  </div>
                  <p>
                    Abra o app pelo ícone na tela inicial para desfrutar de áudio em segundo plano com suporte a hardware!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-5 w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs active:scale-[0.98] transition-transform"
              >
                Entendi
              </button>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Fallback demo install button for desktop/preview inspection
  return (
    <button
      onClick={() => alert('Para instalar como PWA nativo, abra este endereço no navegador do celular (Chrome/Safari) e adicione à tela de início.')}
      aria-label="Informações sobre instalação PWA"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 text-xs font-semibold backdrop-blur-md border border-white/10 active:scale-95 transition-all whitespace-nowrap shrink-0"
    >
      <Download className="w-3.5 h-3.5 text-purple-400" />
      <span>PWA Ready</span>
    </button>
  );
};
