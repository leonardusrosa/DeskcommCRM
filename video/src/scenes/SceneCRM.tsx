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

interface SceneCRMProps {
  content: VideoContent['crm'];
}

export const SceneCRM: React.FC<SceneCRMProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  // Card Drag Animation: from "Nuevo contacto" (left ~200px) to "Consulta agendada" (left ~1022px)
  const dragProgress = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: { damping: 16, stiffness: 85 },
  });

  const isDragging = frame >= 80 && frame < 160;
  const isDropped = frame >= 160;

  // Animated card coordinates: starts exactly over Column 1 card and lands in Column 4 slot
  const cardX = interpolate(dragProgress, [0, 1], [249, 1022]);
  const cardY = interpolate(dragProgress, [0, 0.4, 1], [253, 230, 215]);
  const cardScale = isDragging ? 1.04 : 1;

  // Cursor coordinates tracking the drag:
  // 0-45: rest
  // 50-80: moves to card in Column 1 (310, 290)
  // 80-160: carries card to Column 4 (1070, 260)
  // 160+: settles at destination
  const cursorX = interpolate(
    frame,
    [0, 45, 75, 160, 220],
    [450, 450, 310, 1070, 1070],
    { extrapolateRight: 'clamp' }
  );
  const cursorY = interpolate(
    frame,
    [0, 45, 75, 160, 220],
    [550, 550, 290, 260, 260],
    { extrapolateRight: 'clamp' }
  );

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
            {frame >= 80 && (
              <div
                className="pointer-events-none absolute z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-[#f8fafc]"
                style={{
                  left: 247,
                  top: 251,
                  width: 236,
                  height: 168,
                }}
              >
                <span className="text-[10px] font-medium text-slate-400">
                  {content.stageFrom}
                </span>
              </div>
            )}

            {/* Tight drop slot highlight in "Consulta agendada" */}
            <div
              className="pointer-events-none absolute left-[1018px] top-[212px] h-[168px] w-[236px] rounded-xl border-2 border-dashed transition-all"
              style={{
                borderColor: isDropped ? `${DESKCOMM_SAGE[600]}88` : `${DESKCOMM_SAGE[500]}cc`,
                backgroundColor: isDropped ? `${DESKCOMM_SAGE[500]}08` : `${DESKCOMM_SAGE[500]}12`,
                opacity: interpolate(frame, [60, 80, 180, 220], [0, 1, 1, 0.4], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Dragged Lead Card Simulation */}
            <div
              className="pointer-events-none absolute z-40 w-[236px] rounded-xl border bg-white p-3 shadow-xl transition-all"
              style={{
                left: cardX,
                top: cardY,
                transform: `scale(${cardScale}) rotate(${isDragging ? 2 : 0}deg)`,
                boxShadow: isDragging
                  ? `0 25px 30px -5px ${DESKCOMM_SAGE[600]}44, 0 10px 10px -5px rgba(0, 0, 0, 0.1)`
                  : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                borderColor: isDragging || isDropped ? DESKCOMM_SAGE[600] : '#e2e8f0',
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
                  {isDropped ? content.stageTo : content.stageFrom}
                </span>
                <span className="text-slate-400">{content.timeLabel}</span>
              </div>
            </div>

            {/* Simulated Cursor */}
            <Cursor
              x={cursorX}
              y={cursorY}
              clickFrame={80}
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
          subtitle={`Etapa: ${isDropped ? content.stageTo : content.stageFrom}`}
          badge={content.dealValue}
          className="bottom-12 left-16"
        />
      </div>
    </div>
  );
};
