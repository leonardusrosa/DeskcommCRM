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
import { VideoContent } from '../types';

interface SceneInboxProps {
  content: VideoContent['inbox'];
}

export const SceneInbox: React.FC<SceneInboxProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Camera zoom into conversation
  const zoomProgress = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 18, stiffness: 75 },
  });

  const cameraScale = interpolate(zoomProgress, [0, 1], [1, 1.25]);
  const cameraX = interpolate(zoomProgress, [0, 1], [0, -90]);
  const cameraY = interpolate(zoomProgress, [0, 1], [0, -35]);

  // Cursor movement: from center to conversation list, then to message thread
  const cursorX = interpolate(
    frame,
    [0, 50, 80, 130, 200],
    [650, 310, 310, 680, 680],
    { extrapolateRight: 'clamp' }
  );
  const cursorY = interpolate(
    frame,
    [0, 50, 80, 130, 200],
    [600, 215, 215, 340, 340],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-12 py-8 select-none">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-emerald-200/40 blur-[130px]" />

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
        <BrowserFrame url="demo.deskcomm.autocora.com.br/app/inbox?filter=all">
          <div
            className="relative h-[720px] w-full origin-center overflow-hidden"
            style={{
              transform: `scale(${cameraScale}) translate(${cameraX}px, ${cameraY}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            {/* Screenshot of Inbox */}
            <Img
              src={staticFile('screenshots/inbox.png')}
              className="h-full w-full object-cover object-left-top"
            />

            {/* Conversation Highlight Box on left list */}
            <div
              className="pointer-events-none absolute left-[180px] top-[185px] h-[64px] w-[215px] rounded-lg border-2 border-emerald-500 bg-emerald-500/10 shadow-md ring-4 ring-emerald-500/10"
              style={{
                opacity: interpolate(frame, [40, 70], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Crisp highlight around message thread */}
            <div
              className="pointer-events-none absolute left-[390px] top-[190px] h-[260px] w-[620px] rounded-2xl border-2 border-emerald-500/80 bg-emerald-500/5 shadow-xl ring-4 ring-emerald-500/10"
              style={{
                opacity: interpolate(frame, [90, 120], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Simulated Animated Cursor */}
            <Cursor
              x={cursorX}
              y={cursorY}
              clickFrame={80}
              label={frame > 85 ? content.patientName : undefined}
            />
          </div>
        </BrowserFrame>

        {/* Floating Callout 1: Patient Incoming Context */}
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
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          }
          title={content.patientName}
          subtitle={content.callout}
          badge="WhatsApp"
          className="bottom-12 left-16"
        />

        {/* Floating Callout 2: Treatment & Doctor Assignment */}
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="16 11 18 13 22 9" />
            </svg>
          }
          title="Blanqueamiento dental LED"
          subtitle={`Especialista: ${content.doctorName}`}
          badge="Derivación ágil"
          className="bottom-12 right-16"
        />
      </div>
    </div>
  );
};
