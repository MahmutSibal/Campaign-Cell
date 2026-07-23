'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`p-2 rounded-xl border transition-all duration-300 flex items-center space-x-2 ${
        theme === 'dark'
          ? 'bg-slate-900/80 border-slate-700 text-amber-400 hover:bg-slate-800 hover:border-amber-400/40'
          : 'bg-white border-slate-200 text-turkcell-navy hover:bg-slate-50 hover:border-turkcell-blue/40 shadow-sm'
      } ${className}`}
      title={theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300 hidden sm:inline">Açık Tema</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-turkcell-navy" />
          <span className="text-xs font-semibold text-slate-700 hidden sm:inline">Koyu Tema</span>
        </>
      )}
    </button>
  );
}
