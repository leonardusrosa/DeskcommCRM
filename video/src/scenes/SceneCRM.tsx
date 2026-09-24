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

  const cameraScale = interpolate(zoomProgress, [0, 1], [1, 1.24]);
  const cameraX = interpolate(zoomProgress, [0, 1], [0, -80]);
  const cameraY = interpolate(zoomProgress, [0, 1], [0, -30]);

  // Card Drag Animation: from "Nuevo contacto" (left ~175px) to "Consulta agendada" (left ~1025px)
  const dragProgress = spring({
    frame: Math.max(0, frame - 85),
    fps,
    config: { damping: 16, stiffness: 85 },
  });

  const isDragging = frame >= 80 && frame < 170;
  const isDropped = frame >= 170;

  // Animated card coordinates
  const cardX = interpolate(dragProgress, [0, 1], [175, 1025]);
  const cardY = interpolate(dragProgress, [0, 0.5, 1], [215, 195, 215]);
  const cardScale = isDragging ? 1.05 : 1;

  // Cursor coordinates tracking the drag
  const cursorX = interpolate(
    frame,
    [0, 50, 80, 155, 190, 250],
    [450, 230, 230, 1080, 1080, 1160],
    { extrapolateRight: 'clamp' }
  );
  const cursorY = interpolate(
    frame,
    [0, 50, 80, 155, 190, 250],
    [600, 245, 245, 245, 245, 320],
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

            {/* Target Column Highlight ("Consulta agendada" column) */}
            <div
              className="pointer-events-none absolute left-[1015px] top-[152px] h-[480px] w-[205px] rounded-xl border-2 border-dashed"
              style={{
                borderColor: `${DESKCOMM_SAGE[500]}cc`,
                backgroundColor: `${DESKCOMM_SAGE[500]}0d`,
                opacity: interpolate(frame, [65, 90, 180, 210], [0, 1, 1, 0.35], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Dragged Lead Card Simulation */}
            <div
              className="pointer-events-none absolute z-40 w-[200px] rounded-xl border bg-white p-3 shadow-xl transition-all"
              style={{
                left: cardX,
                top: cardY,
                transform: `scale(${cardScale}) rotate(${isDragging ? 2.5 : 0}deg)`,
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
            />
          </div>
        </BrowserFrame>

        {/* Floating Callout 1: Funnel Progression */}
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

        {/* Floating Callout 2: High Conversion Rate */}
        <FloatingCard
          delay={170}
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          }
          title={content.nextActionTitle}
          subtitle={content.nextActionSubtitle}
          badge={content.nextActionBadge}
          className="bottom-12 right-16"
        />
      </div>
    </div>
  );
};
