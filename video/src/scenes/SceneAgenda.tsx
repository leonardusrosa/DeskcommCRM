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

interface SceneAgendaProps {
  content: VideoContent['agenda'];
}

export const SceneAgenda: React.FC<SceneAgendaProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Camera zoom into appointment grid
  const zoomProgress = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const cameraScale = interpolate(zoomProgress, [0, 1], [1, 1.25]);
  const cameraX = interpolate(zoomProgress, [0, 1], [0, -110]);
  const cameraY = interpolate(zoomProgress, [0, 1], [0, -60]);

  // Cursor pointing to confirmed appointment on calendar
  const cursorX = interpolate(
    frame,
    [0, 50, 90, 150, 210],
    [500, 780, 780, 960, 960],
    { extrapolateRight: 'clamp' }
  );
  const cursorY = interpolate(
    frame,
    [0, 50, 90, 150, 210],
    [600, 410, 410, 535, 535],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-12 py-8 select-none">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full blur-[130px]"
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
        <BrowserFrame url="demo.deskcomm.autocora.com.br/app/agenda">
          <div
            className="relative h-[720px] w-full origin-center overflow-hidden"
            style={{
              transform: `scale(${cameraScale}) translate(${cameraX}px, ${cameraY}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            {/* Screenshot of Agenda */}
            <Img
              src={staticFile('screenshots/agenda.png')}
              className="h-full w-full object-cover object-left-top"
            />

            {/* List Row Spotlight */}
            <div
              className="pointer-events-none absolute left-[138px] top-[390px] h-[48px] w-[980px] rounded-xl border-2 shadow-lg ring-4"
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

            {/* Calendar Block Spotlight on Thursday 11h */}
            <div
              className="pointer-events-none absolute left-[900px] top-[515px] h-[42px] w-[185px] rounded-lg border-2 shadow-md ring-4"
              style={{
                borderColor: DESKCOMM_SAGE[600],
                backgroundColor: `${DESKCOMM_SAGE[600]}33`,
                boxShadow: `0 0 0 4px ${DESKCOMM_SAGE[500]}33`,
                opacity: interpolate(frame, [80, 110], [0, 1], {
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
              label={frame > 95 ? content.statusConfirmed : undefined}
            />
          </div>
        </BrowserFrame>

        {/* Floating Callout 1: Appointment Info */}
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
          title={content.appointmentTitle}
          subtitle={content.specialistText}
          badge={content.statusConfirmed}
          className="bottom-12 left-16"
        />

        {/* Floating Callout 2: Notification Follow-up */}
        <FloatingCard
          delay={150}
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
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          }
          title={content.notificationTitle}
          subtitle={content.notificationSubtitle}
          badge={content.notificationBadge}
          className="bottom-12 right-16"
        />
      </div>
    </div>
  );
};
