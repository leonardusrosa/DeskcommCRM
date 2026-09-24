import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DESKCOMM_SAGE } from '../theme';

interface OverlayBadgeProps {
  badge: string;
  headline: string;
  subtitle: string;
  className?: string;
  style?: React.CSSProperties;
}

export const OverlayBadge: React.FC<OverlayBadgeProps> = ({
  badge,
  headline,
  subtitle,
  className = '',
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const translateY = interpolate(entrance, [0, 1], [-20, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      className={`flex flex-col items-center text-center ${className}`}
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        ...style,
      }}
    >
      {/* Category Pill Badge */}
      <div
        className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold tracking-wider shadow-xs"
        style={{
          backgroundColor: DESKCOMM_SAGE[50],
          borderColor: DESKCOMM_SAGE[200],
          color: DESKCOMM_SAGE[800],
        }}
      >
        <span
          className="h-2 w-2 rounded-full animate-pulse"
          style={{ backgroundColor: DESKCOMM_SAGE[600] }}
        />
        {badge}
      </div>

      {/* Main Headline */}
      <h2 className="mt-2.5 max-w-4xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        {headline}
      </h2>

      {/* Subtitle */}
      <p className="mt-1.5 max-w-2xl text-base font-normal text-slate-600 sm:text-lg">
        {subtitle}
      </p>
    </div>
  );
};
