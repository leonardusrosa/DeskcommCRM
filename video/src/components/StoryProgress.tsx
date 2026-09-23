import React from 'react';
import { useCurrentFrame } from 'remotion';

interface StoryProgressProps {
  currentFrame: number;
}

const STEPS = [
  { label: 'Inbox', start: 150, end: 555 },
  { label: 'CRM', start: 555, end: 990 },
  { label: 'Agenda', start: 990, end: 1425 },
  { label: 'Equipo', start: 1425, end: 1770 },
  { label: 'Demo', start: 1770, end: 2085 },
];

export const StoryProgress: React.FC<StoryProgressProps> = () => {
  const frame = useCurrentFrame();

  // Hide during opening intro
  if (frame < 140) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-3 z-50 flex items-center gap-5 rounded-full border border-slate-200/80 bg-white/90 px-5 py-1.5 shadow-lg backdrop-blur-md select-none">
      {STEPS.map((step, idx) => {
        const isActive = frame >= step.start && frame < step.end;
        const isPast = frame >= step.end;

        return (
          <div key={idx} className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full transition-all ${
                isActive
                  ? 'scale-125 bg-emerald-600 ring-4 ring-emerald-500/20'
                  : isPast
                    ? 'bg-emerald-700/60'
                    : 'bg-slate-300'
              }`}
            />
            <span
              className={`text-[11px] font-bold tracking-wider uppercase transition-colors ${
                isActive
                  ? 'text-slate-900'
                  : isPast
                    ? 'text-slate-600'
                    : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <span className="text-slate-300 text-[10px] ml-2 font-light">/</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
