
import React from 'react';
import { Phase } from '../types';

interface LayoutProps {
  currentPhase: Phase;
  onPhaseChange: (phase: Phase) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentPhase, onPhaseChange, children }) => {
  const phases = Object.values(Phase);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">
          Hackathon Build <span className="text-indigo-600">Evolution</span>
        </h1>
        <p className="text-slate-500">Watching the Todo app grow through Spec-Drive AI</p>
      </header>

      <nav className="flex flex-wrap justify-center gap-2 mb-12">
        {phases.map((phase, idx) => (
          <button
            key={phase}
            onClick={() => onPhaseChange(phase)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              currentPhase === phase
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Phase {idx + 1}
          </button>
        ))}
      </nav>

      <main className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 min-h-[500px]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{currentPhase}</h2>
            <p className="text-sm text-slate-400">Build Iteration Progress</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-bold">
            {phases.indexOf(currentPhase) + 1}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default Layout;
