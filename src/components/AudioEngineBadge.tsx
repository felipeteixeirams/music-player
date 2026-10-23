import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, CheckCircle2, AlertTriangle, Layers, Radio, X, ExternalLink, Zap } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { PIPED_INSTANCES } from '../utils/audioEngine';
import { AudioEngineType } from '../types/music';

export const AudioEngineBadge: React.FC = () => {
  const { activeEngine, pipedStatus, switchEngineManually, currentTrack } = useAudio();
  const [isOpen, setIsOpen] = useState(false);

  const getEngineDetails = () => {
    switch (activeEngine) {
      case 'native':
        return {
          label: 'Nativo Direto',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          dot: 'bg-emerald-400',
          desc: 'Stream de alta fidelidade via link direto de áudio em nuvem (MP3/WebM).'
        };
      case 'piped':
        return {
          label: 'Piped API Puro',
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
          dot: 'bg-purple-400',
          desc: 'Fluxo de áudio puro extraído via Piped API pública (sem vídeo e sem anúncios).'
        };
      case 'fallback':
        return {
          label: 'Headless Fallback',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          dot: 'bg-amber-400',
          desc: 'Motor redundante operando em background (1px x 1px) garantindo resiliência.'
        };
    }
  };

  const details = getEngineDetails();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Abrir diagnóstico da Arquitetura Híbrida de Áudio"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium backdrop-blur-md transition-all active:scale-95 whitespace-nowrap ${details.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${details.dot} animate-pulse`} />
        <span>{details.label}</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#10101b] border border-white/10 p-5 shadow-2xl text-left text-white max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Arquitetura de Áudio Híbrida</h3>
                    <p className="text-[11px] text-white/50">Fallback inteligente transparente</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar painel de arquitetura"
                  className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current Active Engine Card */}
              <div className="mt-4 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-white/50">CAMADA EM EXECUÇÃO</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${details.color}`}>
                    {details.label}
                  </span>
                </div>
                <p className="text-xs text-white/80">{details.desc}</p>
                {pipedStatus.quality && (
                  <div className="pt-2 text-[11px] text-white/60 flex items-center gap-1.5 border-t border-white/5">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span>Qualidade: {pipedStatus.quality}</span>
                  </div>
                )}
                {pipedStatus.instanceUsed && (
                  <div className="text-[11px] text-white/40 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    <span>Instância: {pipedStatus.instanceUsed}</span>
                  </div>
                )}
              </div>

              {/* Manual Switcher Controls */}
              <div className="mt-4 space-y-2">
                <span className="text-[11px] font-medium text-white/50 block">TESTAR CAMADAS MANUALMENTE</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['native', 'piped', 'fallback'] as AudioEngineType[]).map((eng) => {
                    const isActive = activeEngine === eng;
                    return (
                      <button
                        key={eng}
                        onClick={() => switchEngineManually(eng)}
                        className={`p-2.5 rounded-2xl text-left border text-xs transition-all ${
                          isActive
                            ? 'bg-purple-600/30 border-purple-500 text-white font-semibold'
                            : 'bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="capitalize">{eng === 'native' ? 'Nativo' : eng === 'piped' ? 'Piped' : 'Fallback'}</span>
                          {isActive && <CheckCircle2 className="w-3 h-3 text-purple-400" />}
                        </div>
                        <span className="text-[9px] text-white/40 block mt-1">
                          {eng === 'native' ? 'MP3 Direto' : eng === 'piped' ? 'Pure Audio' : 'Headless'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Explanatory Specs */}
              <div className="mt-4 pt-3 border-t border-white/10 space-y-2.5 text-xs text-white/70">
                <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                  Resumo da Especificação Técnica
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">100% Livre de Vídeo:</strong> Apenas os fluxos de áudio Opus/M4A são baixados, economizando até 85% de dados móveis e bateria.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Piped API:</strong> Consultas aos endpoints <code className="text-purple-300">/streams/{"{id}"}</code> com rotação automática entre instâncias públicas redundantes.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Motor Redundante:</strong> React-Player em 1px x 1px para continuidade sonora se a rede restringir requisições de API.
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="mt-5 w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs active:scale-[0.98] transition-transform"
              >
                Fechar Diagnóstico
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
