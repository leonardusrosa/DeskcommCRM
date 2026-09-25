import React from 'react';
import {
  Easing,
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
import { CRM_VIEWPORT_GEOMETRY } from '../geometry';
import { DESKCOMM_SAGE } from '../theme';
import { VideoContent } from '../types';

interface SceneCRMProps {
  content: VideoContent['crm'];
}

export const SceneCRM: React.FC<SceneCRMProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sourceCard = CRM_VIEWPORT_GEOMETRY.sourceCardMask;
  const dropSlot = CRM_VIEWPORT_GEOMETRY.dropSlot;

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Camera zoom into pipeline
  const zoomProgress = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const cameraScale = interpolate(zoomProgress, [0, 1], [1, 1.22]);
  const cameraX = interpolate(zoomProgress, [0, 1], [0, -80]);
  const cameraY = interpolate(zoomProgress, [0, 1], [0, -28]);

  // Choreography keyframes
  const DRAG_START = 95;
  const DRAG_END = 170;
  const GRAB_FRAME = 90;
  const RELEASE_HOLD = 190;

  // Semantic interaction states
  const hasGrabbed = frame >= DRAG_START;
  const isDragging = frame >= DRAG_START && frame < DRAG_END;
  const hasDropped = frame >= DRAG_END;

  // Single shared deterministic drag progress (cubic in-out)
  const dragProgress = interpolate(
    frame,
    [DRAG_START, DRAG_END],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    }
  );

  // Card coordinates strictly driven by shared dragProgress
  const cardX = interpolate(
    dragProgress,
    [0, 1],
    [sourceCard.left, dropSlot.left]
  );
  const cardY = interpolate(
    dragProgress,
    [0, 0.5, 1],
    [sourceCard.top, sourceCard.top - 20, dropSlot.top]
  );
  const cardScale = isDragging ? 1.04 : 1;

  // Invariant grip offset: fixed relative to card top-left
  const GRIP_X = 85;
  const GRIP_Y = 40;
  const sourceGripX = sourceCard.left + GRIP_X;
  const sourceGripY = sourceCard.top + GRIP_Y;
  const dropGripX = dropSlot.left + GRIP_X;
  const dropGripY = dropSlot.top + GRIP_Y;

  // Cursor trajectory: approaches card, grabs, locked to card during drag, releases
  let cursorX: number;
  let cursorY: number;

  if (frame < DRAG_START) {
    // 0-45: rest at overview, 45-75: approach source card, 75-95: rest on card & grab
    cursorX = interpolate(frame, [0, 45, 75], [450, 450, sourceGripX], {
      extrapolateRight: 'clamp',
    });
    cursorY = interpolate(frame, [0, 45, 75], [550, 550, sourceGripY], {
      extrapolateRight: 'clamp',
    });
  } else if (frame < DRAG_END) {
    // 95-170: locked 1:1 to card trajectory with invariant grip offset
    cursorX = cardX + GRIP_X;
    cursorY = cardY + GRIP_Y;
  } else if (frame < RELEASE_HOLD) {
    // 170-190: brief settled state / release at destination
    cursorX = dropGripX;
    cursorY = dropGripY;
  } else {
    // 190+: gently moves away from dropped card
    cursorX = interpolate(frame, [190, 230], [dropGripX, dropGripX + 30], {
      extrapolateRight: 'clamp',
    });
    cursorY = interpolate(frame, [190, 230], [dropGripY, dropGripY + 95], {
      extrapolateRight: 'clamp',
    });
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-12 py-8 select-none">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full blur-[130px]"
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
        <BrowserFrame url="demo.deskcomm.autocora.com.br/app/pipelines/tratamientos-odontologicos">
          <div
            className="relative h-[720px] w-full origin-center overflow-hidden"
            style={{
              transform: `scale(${cameraScale}) translate(${cameraX}px, ${cameraY}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            {/* Screenshot of Kanban */}
            <Img
              src={staticFile('screenshots/crm_kanban.png')}
              className="h-full w-full object-cover object-left-top"
            />

            {/* Source card mask in "Nuevo contacto" — covers duplicate card during & after drag */}
            {hasGrabbed && (
              <div
                className="pointer-events-none absolute z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-[#f8fafc]"
                style={{
                  left: sourceCard.left,
                  top: sourceCard.top,
                  width: sourceCard.width,
                  height: sourceCard.height,
                }}
              >
                <span className="text-[10px] font-medium text-slate-400">
                  {content.stageFrom}
                </span>
              </div>
            )}

            {/* Destination slot highlight in "Consulta agendada" */}
            <div
              className="pointer-events-none absolute rounded-xl border-2 border-dashed transition-all"
              style={{
                left: dropSlot.left,
                top: dropSlot.top,
                width: dropSlot.width,
                height: dropSlot.height,
                borderColor: hasDropped ? `${DESKCOMM_SAGE[600]}88` : `${DESKCOMM_SAGE[500]}cc`,
                backgroundColor: hasDropped ? `${DESKCOMM_SAGE[500]}08` : `${DESKCOMM_SAGE[500]}14`,
                opacity: interpolate(frame, [60, 80, 180, 220], [0.85, 1, 1, 0.4], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Movable Lead Card Simulation — appears only once grabbed */}
            {hasGrabbed && (
              <div
                className="pointer-events-none absolute z-40 rounded-xl border bg-white p-3 shadow-xl transition-all"
                style={{
                  left: cardX,
                  top: cardY,
                  width: dropSlot.width,
                  minHeight: dropSlot.height,
                  transform: `scale(${cardScale}) rotate(${isDragging ? 2 : 0}deg)`,
                  boxShadow: isDragging
                    ? `0 25px 30px -5px ${DESKCOMM_SAGE[600]}44, 0 10px 10px -5px rgba(0, 0, 0, 0.1)`
                    : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  borderColor: isDragging || hasDropped ? DESKCOMM_SAGE[600] : '#e2e8f0',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 leading-snug">
                    {content.dealName}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                    style={{
                      backgroundColor: DESKCOMM_SAGE[100],
                      color: DESKCOMM_SAGE[800],
                    }}
                  >
                    {content.dealValue}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {content.dealPhone}
                </p>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px]">
                  <span
                    className="font-semibold"
                    style={{ color: DESKCOMM_SAGE[700] }}
                  >
                    {hasDropped ? content.stageTo : content.stageFrom}
                  </span>
                  <span className="text-slate-400">{content.timeLabel}</span>
                </div>
              </div>
            )}

            {/* Simulated Cursor */}
            <Cursor
              x={cursorX}
              y={cursorY}
              clickFrame={GRAB_FRAME}
              isPressed={isDragging}
              label={isDragging ? content.movingLabel : undefined}
              labelPosition="top"
            />
          </div>
        </BrowserFrame>

        {/* Single dominant floating callout: Funnel Progression */}
        <FloatingCard
          delay={90}
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
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
          title={content.pipelineName}
          subtitle={`Etapa: ${hasDropped ? content.stageTo : content.stageFrom}`}
          badge={content.dealValue}
          className="bottom-12 left-16"
        />
      </div>
    </div>
  );
};
