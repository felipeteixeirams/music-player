import React, { useState } from 'react';
import { MAX_NAME_LENGTH } from '../utils/playlists';

interface NameDialogProps {
  title: string;
  initial?: string;
  placeholder?: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** Asks for a name (a new playlist, a rename). Enter confirms; tapping outside or "Cancelar" closes. */
export const NameDialog: React.FC<NameDialogProps> = ({ title, initial = '', placeholder = 'Nome', confirmLabel, onSubmit, onClose }) => {
  const [name, setName] = useState(initial);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 animate-in fade-in" onClick={onClose}>
      <form
        role="dialog"
        aria-label={title}
        className="w-full max-w-xs rounded-sheet p-5 shadow-2xl text-left text-label space-y-4 relative"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(name);
        }}
      >
        <div className="absolute inset-0 -z-10 rounded-sheet material-thick" aria-hidden="true" />
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <input
          autoFocus
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          aria-label="Nome da playlist"
          className="w-full h-10 px-3.5 rounded-card bg-fill-tertiary text-label placeholder:text-label-secondary text-[17px] focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-card bg-fill-tertiary text-label text-[15px] font-medium active:scale-[0.98]">
            Cancelar
          </button>
          <button type="submit" className="flex-1 py-2.5 rounded-card bg-accent text-white text-[15px] font-semibold active:scale-[0.98]">
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, confirmLabel, onConfirm, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 animate-in fade-in" onClick={onClose}>
    <div
      role="alertdialog"
      aria-label={title}
      className="w-full max-w-xs rounded-sheet p-5 shadow-2xl text-left text-label space-y-3 relative"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 -z-10 rounded-sheet material-thick" aria-hidden="true" />
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="text-[15px] text-label-secondary">{message}</p>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-card bg-fill-tertiary text-label text-[15px] font-medium active:scale-[0.98]">
          Cancelar
        </button>
        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-card bg-accent text-white text-[15px] font-semibold active:scale-[0.98]">
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
