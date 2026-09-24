import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DESKCOMM_SAGE } from '../theme';

interface FloatingCardProps {
  delay?: number;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const FloatingCard: React.FC<FloatingCardProps> = ({
  delay = 0,
  icon,
  title,
  subtitle,
  badge,
  className = '',
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 14, stiffness: 140 },
  });

  const translateY = interpolate(progress, [0, 1], [30, 0]);
  const scale = interpolate(progress, [0, 1], [0.92, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      className={`absolute z-30 flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md ${className}`}
      style={{
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
        boxShadow:
          '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
        ...style,
      }}
    >
      {icon && (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs"
          style={{
            backgroundColor: DESKCOMM_SAGE[50],
            borderColor: DESKCOMM_SAGE[200],
            color: DESKCOMM_SAGE[600],
          }}
        >
          {icon}
        </div>
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{title}</span>
          {badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: DESKCOMM_SAGE[100],
                color: DESKCOMM_SAGE[800],
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
    </div>
  );
};
