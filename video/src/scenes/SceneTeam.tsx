import React from 'react';
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { Cursor } from '../components/Cursor';
import { FloatingCard } from '../components/FloatingCard';
import { OverlayBadge } from '../components/OverlayBadge';
import { DESKCOMM_SAGE } from '../theme';
import { VideoContent } from '../types';

interface SceneTeamProps {
  content: VideoContent['team'];
}

export const SceneTeam: React.FC<SceneTeamProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Camera zoom into table
  const zoomProgress = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const cameraScale = interpolate(zoomProgress, [0, 1], [1, 1.22]);
  const cameraX = interpolate(zoomProgress, [0, 1], [0, -90]);
  const cameraY = interpolate(zoomProgress, [0, 1], [0, -35]);

  // Cursor movement across members
  const cursorX = interpolate(
    frame,
    [0, 50, 90, 150, 200],
    [500, 340, 340, 430, 430],
    { extrapolateRight: 'clamp' }
  );
  const cursorY = interpolate(
    frame,
    [0, 50, 90, 150, 200],
    [600, 275, 275, 335, 335],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-12 py-8 select-none">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-32 right-1/3 h-96 w-96 rounded-full blur-[130px]"
        style={{ backgroundColor: `${DESKCOMM_SAGE[200]}40` }}
      />

      {/* Header Info */}
      <OverlayBadge
        badge={content.badge}
        headline={content.headline}
        subtitle={content.subtitle}
        className="z-20 mb-3"
      />

      {/* Main Browser Viewport */}
      <div
        className="relative z-10 w-full max-w-[1620px] origin-top flex-1 overflow-hidden"
        style={{
          transform: `scale(${interpolate(entrance, [0, 1], [0.95, 1])})`,
          opacity: interpolate(entrance, [0, 1], [0, 1]),
        }}
      >
        <BrowserFrame url="demo.deskcomm.autocora.com.br/app/team">
          <div
            className="relative h-[720px] w-full origin-center overflow-hidden"
            style={{
              transform: `scale(${cameraScale}) translate(${cameraX}px, ${cameraY}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            {/* Screenshot of Team */}
            <Img
              src={staticFile('screenshots/team.png')}
              className="h-full w-full object-cover object-left-top"
            />

            {/* Member Table Spotlight (Dra. Laura & Carolina) */}
            <div
              className="pointer-events-none absolute left-[140px] top-[265px] h-[140px] w-[950px] rounded-xl border-2 shadow-lg ring-4"
              style={{
                borderColor: `${DESKCOMM_SAGE[500]}cc`,
                backgroundColor: `${DESKCOMM_SAGE[500]}1a`,
                boxShadow: `0 0 0 4px ${DESKCOMM_SAGE[500]}20`,
                opacity: interpolate(frame, [40, 70], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Cursor */}
            <Cursor
              x={cursorX}
              y={cursorY}
              clickFrame={90}
              label={frame > 95 ? content.accountabilityTag : undefined}
            />
          </div>
        </BrowserFrame>

        {/* Floating Callout 1: Active Specialists */}
        <FloatingCard
          delay={60}
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title={content.coordinationTitle}
          subtitle={content.coordinationSubtitle}
          badge={content.coordinationBadge}
          className="bottom-12 left-16"
        />

        {/* Floating Callout 2: Roles and Permissions */}
        <FloatingCard
          delay={140}
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          }
          title={content.accessControlTitle}
          subtitle={content.accessControlSubtitle}
          badge={content.accessControlBadge}
          className="bottom-12 right-16"
        />
      </div>
    </div>
  );
};
