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
import { INBOX_VIEWPORT_GEOMETRY } from '../geometry';
import { DESKCOMM_SAGE } from '../theme';
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

  const cameraScale = interpolate(zoomProgress, [0, 1], [1, 1.22]);
  const cameraX = interpolate(zoomProgress, [0, 1], [0, -70]);
  const cameraY = interpolate(zoomProgress, [0, 1], [0, -25]);

  // Cursor movement:
  // 0-45: rest
  // 45-80: moves to incoming message
  // 85-125: shifts to agent reply bubble
  const cursorX = interpolate(
    frame,
    [0, 45, 80, 125, 200],
    [
      580,
      580,
      INBOX_VIEWPORT_GEOMETRY.incomingMessage.left + 50,
      INBOX_VIEWPORT_GEOMETRY.agentReply.left + 50,
      INBOX_VIEWPORT_GEOMETRY.agentReply.left + 50,
    ],
    { extrapolateRight: 'clamp' }
  );
  const cursorY = interpolate(
    frame,
    [0, 45, 80, 125, 200],
    [
      480,
      480,
      INBOX_VIEWPORT_GEOMETRY.incomingMessage.top + 28,
      INBOX_VIEWPORT_GEOMETRY.agentReply.top + 35,
      INBOX_VIEWPORT_GEOMETRY.agentReply.top + 35,
    ],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-12 py-8 select-none">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/3 h-96 w-96 rounded-full blur-[130px]"
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

            {/* Right sidebar subtle demotion mask during message focus */}
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-[270px] bg-slate-900/10 backdrop-blur-[0.5px]"
              style={{
                opacity: interpolate(frame, [45, 75], [0, 0.45], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Stage 1: Tight highlight around incoming customer message (frames 45-105) */}
            <div
              className="pointer-events-none absolute rounded-2xl border-2 shadow-md ring-4"
              style={{
                left: INBOX_VIEWPORT_GEOMETRY.incomingMessage.left,
                top: INBOX_VIEWPORT_GEOMETRY.incomingMessage.top,
                width: INBOX_VIEWPORT_GEOMETRY.incomingMessage.width,
                height: INBOX_VIEWPORT_GEOMETRY.incomingMessage.height,
                borderColor: `${DESKCOMM_SAGE[400]}cc`,
                backgroundColor: `${DESKCOMM_SAGE[200]}18`,
                boxShadow: `0 0 0 4px ${DESKCOMM_SAGE[400]}20`,
                opacity: interpolate(frame, [45, 60, 95, 105], [0, 1, 1, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Stage 2: Tight highlight hugging green agent reply bubble (frames 105-390) */}
            <div
              className="pointer-events-none absolute rounded-2xl border-2 shadow-xl ring-4"
              style={{
                left: INBOX_VIEWPORT_GEOMETRY.agentReply.left,
                top: INBOX_VIEWPORT_GEOMETRY.agentReply.top,
                width: INBOX_VIEWPORT_GEOMETRY.agentReply.width,
                height: INBOX_VIEWPORT_GEOMETRY.agentReply.height,
                borderColor: DESKCOMM_SAGE[500],
                backgroundColor: `${DESKCOMM_SAGE[500]}14`,
                boxShadow: `0 0 0 4px ${DESKCOMM_SAGE[500]}25`,
                opacity: interpolate(frame, [105, 120], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Cursor points to agent bubble with label placed cleanly to the left in open space */}
            <Cursor
              x={cursorX}
              y={cursorY}
              clickFrame={125}
              label={frame > 125 ? content.patientName : undefined}
              labelPosition="left"
            />
          </div>
        </BrowserFrame>

        {/* Single dominant floating card: Patient Incoming WhatsApp Context */}
        <FloatingCard
          delay={70}
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
          badge={content.channelBadge}
          className="bottom-12 left-16"
        />
      </div>
    </div>
  );
};
