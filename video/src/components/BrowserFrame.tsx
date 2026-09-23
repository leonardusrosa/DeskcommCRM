import React from 'react';

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  children,
  url = 'demo.deskcomm.autocora.com.br/app/inbox',
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 ${className}`}
      style={{
        boxShadow:
          '0 25px 50px -12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.06)',
        ...style,
      }}
    >
      {/* Top Browser Bar */}
      <div className="flex h-11 items-center justify-between border-b border-slate-200/80 bg-slate-100/90 px-4 backdrop-blur-sm select-none">
        {/* Window controls */}
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 rounded-full bg-[#ef4444]/90 shadow-sm" />
          <div className="h-3 w-3 rounded-full bg-[#f59e0b]/90 shadow-sm" />
          <div className="h-3 w-3 rounded-full bg-[#10b981]/90 shadow-sm" />
        </div>

        {/* Address Bar */}
        <div className="flex max-w-xl flex-1 items-center justify-center px-4">
          <div className="flex h-7 w-full max-w-md items-center justify-center rounded-md border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="mr-1.5 text-emerald-600">🔒</span>
            <span className="truncate tracking-tight font-mono text-slate-500">
              https://{url}
            </span>
          </div>
        </div>

        {/* Right dummy actions */}
        <div className="flex items-center space-x-2 text-slate-400 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
          <span className="text-[10px] font-semibold text-slate-500 tracking-wider">
            DESKCOMM
          </span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative w-full overflow-hidden bg-slate-50">{children}</div>
    </div>
  );
};
