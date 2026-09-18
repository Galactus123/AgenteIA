"use client";

import { X, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  message?: string;
}

export default function UpgradeModal({ isOpen, onClose, currentPlan = "Start", message }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#161926] border border-slate-200 dark:border-[rgba(99,102,241,0.15)] shadow-2xl p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <Sparkles size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Recurso disponível em plano superior
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Plano atual: {currentPlan}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          {message ?? "Esta funcionalidade não está disponível no seu plano atual. Faça upgrade para desbloquear este recurso e muito mais."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/precos"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Ver planos
            <ArrowRight size={16} />
          </Link>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 dark:bg-white/5 px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-white/10"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
