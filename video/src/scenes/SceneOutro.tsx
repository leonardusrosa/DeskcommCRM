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
import { OverlayBadge } from '../components/OverlayBadge';
import { DESKCOMM_SAGE } from '../theme';
import { VideoContent } from '../types';

interface SceneOutroProps {
  content: VideoContent['outro'];
}

export const SceneOutro: React.FC<SceneOutroProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Outro overlay card entrance at frame 95
  const overlayProgress = spring({
    frame: Math.max(0, frame - 95),
    fps,
    config: { damping: 14, stiffness: 110 },
  });

  // Cursor Phase 1 (frames 0-90): points directly to Colombia card on /demo (936, 334)
  // Cursor Phase 2 (frames 95-200): moves directly to the CTA button center (810, 500) and clicks
  const cursorX = interpolate(
    frame,
    [0, 30, 65, 95, 135, 160],
    [650, 650, 936, 936, 810, 810],
    { extrapolateRight: 'clamp' }
  );
  const cursorY = interpolate(
    frame,
    [0, 30, 65, 95, 135, 160],
    [480, 480, 334, 334, 500, 500],
    { extrapolateRight: 'clamp' }
  );

  const isModalOpen = frame >= 95;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-12 py-8 select-none">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-40 h-[600px] w-[900px] rounded-full blur-[150px]"
        style={{ backgroundColor: `${DESKCOMM_SAGE[200]}45` }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-20 h-[500px] w-[700px] rounded-full blur-[130px]"
        style={{ backgroundColor: `${DESKCOMM_SAGE[100]}60` }}
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
        <BrowserFrame url="demo.deskcomm.autocora.com.br/demo">
          <div className="relative h-[720px] w-full overflow-hidden">
            {/* Screenshot of Demo Landing */}
            <Img
              src={staticFile('screenshots/demo_catalog.png')}
              className="h-full w-full object-cover object-center"
            />

            {/* Colombia Card Focus Spotlight — tightly hugging the Colombia market card */}
            <div
              className="pointer-events-none absolute left-[832px] top-[281px] h-[107px] w-[208px] rounded-xl border-2 shadow-lg ring-4"
              style={{
                borderColor: DESKCOMM_SAGE[500],
                backgroundColor: `${DESKCOMM_SAGE[500]}1a`,
                boxShadow: `0 0 0 4px ${DESKCOMM_SAGE[500]}25`,
                opacity: interpolate(frame, [25, 50, 90, 95], [0, 1, 1, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            />

            {/* Animated Cursor */}
            <Cursor
              x={cursorX}
              y={cursorY}
              clickFrame={isModalOpen ? 160 : 65}
              label={!isModalOpen && frame > 65 ? content.oneClickBadge : undefined}
              labelPosition="top"
            />

            {/* Final Conversion Modal Card (Slides up at frame 95) */}
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-md"
              style={{
                opacity: interpolate(overlayProgress, [0, 1], [0, 1]),
                pointerEvents: isModalOpen ? 'auto' : 'none',
              }}
            >
              <div
                className="flex w-full max-w-xl flex-col items-center rounded-3xl border border-slate-100 bg-white p-9 text-center shadow-2xl"
                style={{
                  transform: `scale(${interpolate(overlayProgress, [0, 1], [0.9, 1])})`,
                }}
              >
                {/* Logo */}
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl"
                  style={{
                    backgroundColor: DESKCOMM_SAGE[700],
                    boxShadow: `0 10px 20px -3px ${DESKCOMM_SAGE[900]}33`,
                  }}
                >
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <path d="M8 10h.01" />
                    <path d="M12 10h.01" />
                    <path d="M16 10h.01" />
                  </svg>
                </div>

                <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  {content.headline}
                </h3>
                <p className="mt-1.5 max-w-md text-sm text-slate-600 sm:text-base">
                  {content.subtitle}
                </p>

                {/* Features checklist */}
                <div className="mt-5 grid w-full grid-cols-2 gap-2.5 text-left">
                  {content.features.map((feat, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: DESKCOMM_SAGE[100],
                          color: DESKCOMM_SAGE[800],
                        }}
                      >
                        ✓
                      </div>
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {feat}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Action Button */}
                <div className="mt-6 flex w-full flex-col items-center gap-4">
                  <div
                    className="flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-bold text-white shadow-xl transition-transform hover:scale-[1.02]"
                    style={{
                      backgroundColor: DESKCOMM_SAGE[700],
                      boxShadow: `0 12px 25px -4px ${DESKCOMM_SAGE[900]}40`,
                    }}
                  >
                    <span>{content.ctaButton}</span>
                  </div>
                  <span
                    className="font-mono text-xs font-semibold"
                    style={{ color: DESKCOMM_SAGE[700] }}
                  >
                    https://{content.url}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
};
