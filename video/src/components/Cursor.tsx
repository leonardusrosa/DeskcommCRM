import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DESKCOMM_SAGE } from '../theme';

interface CursorProps {
  x: number;
  y: number;
  clickFrame?: number;
  label?: string;
  style?: React.CSSProperties;
}

export const Cursor: React.FC<CursorProps> = ({
  x,
  y,
  clickFrame,
  label,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isClicking =
    clickFrame !== undefined && frame >= clickFrame && frame <= clickFrame + 15;

  const clickScale =
    clickFrame !== undefined
      ? spring({
          frame: frame - clickFrame,
          fps,
          config: { damping: 12, stiffness: 200 },
        })
      : 0;

  const rippleScale = isClicking ? interpolate(clickScale, [0, 1], [0.8, 2.2]) : 0;
  const rippleOpacity = isClicking
    ? interpolate(frame - clickFrame!, [0, 15], [0.8, 0], {
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <div
      className="pointer-events-none absolute z-50 transition-transform select-none"
      style={{
        left: x,
        top: y,
        transform: `translate(-2px, -2px)`,
        ...style,
      }}
    >
      {/* Click Ripple */}
      {isClicking && (
        <div
          className="absolute -left-3 -top-3 h-8 w-8 rounded-full border-2"
          style={{
            borderColor: DESKCOMM_SAGE[500],
            backgroundColor: `${DESKCOMM_SAGE[400]}33`,
            transform: `scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      )}

      {/* SVG Mouse Pointer */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md"
        style={{
          transform: isClicking ? 'scale(0.88)' : 'scale(1)',
          transition: 'transform 0.1s ease',
        }}
      >
        <path
          d="M4.5 3L11.5 21L14.5 13.5L22 10.5L4.5 3Z"
          fill="#0f172a"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Optional Pill Tag next to cursor */}
      {label && (
        <div
          className="ml-5 -mt-3 inline-flex items-center rounded-full bg-slate-900/90 px-2.5 py-0.5 text-[11px] font-medium shadow-md backdrop-blur-sm"
          style={{ color: DESKCOMM_SAGE[300] }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
