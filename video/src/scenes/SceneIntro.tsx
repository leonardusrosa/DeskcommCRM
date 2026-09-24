import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DESKCOMM_SAGE } from '../theme';
import { VideoContent } from '../types';

interface SceneIntroProps {
  content: VideoContent['intro'];
}

export const SceneIntro: React.FC<SceneIntroProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance animations
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const contentSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const cardsSpring = spring({
    frame: Math.max(0, frame - 35),
    fps,
    config: { damping: 14, stiffness: 110 },
  });

  const logoScale = interpolate(logoSpring, [0, 1], [0.8, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  const contentY = interpolate(contentSpring, [0, 1], [40, 0]);
  const contentOpacity = interpolate(contentSpring, [0, 1], [0, 1]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 px-16 text-center select-none">
      {/* Background ambient sage glow */}
      <div
        className="pointer-events-none absolute -top-40 h-[600px] w-[900px] rounded-full blur-[140px]"
        style={{ backgroundColor: `${DESKCOMM_SAGE[200]}55` }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-20 h-[500px] w-[700px] rounded-full blur-[120px]"
        style={{ backgroundColor: `${DESKCOMM_SAGE[100]}77` }}
      />

      {/* Main Container */}
      <div className="relative z-10 flex max-w-5xl flex-col items-center">
        {/* Brand Icon & Name */}
        <div
          className="flex items-center gap-3.5"
          style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{
              backgroundColor: DESKCOMM_SAGE[700],
              boxShadow: `0 10px 15px -3px ${DESKCOMM_SAGE[900]}33`,
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
          <span className="text-3xl font-extrabold tracking-tight text-slate-900">
            Deskcomm<span style={{ color: DESKCOMM_SAGE[600] }}>CRM</span>
          </span>
        </div>

        {/* Category Pill */}
        <div
          className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-widest shadow-xs"
          style={{
            backgroundColor: DESKCOMM_SAGE[50],
            borderColor: DESKCOMM_SAGE[200],
            color: DESKCOMM_SAGE[800],
            opacity: logoOpacity,
          }}
        >
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: DESKCOMM_SAGE[600] }}
          />
          {content.badge}
        </div>

        {/* Headline & Subtitle */}
        <div
          className="mt-5"
          style={{
            transform: `translateY(${contentY}px)`,
            opacity: contentOpacity,
          }}
        >
          <h1 className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">
            {content.title}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-xl leading-relaxed text-slate-600 sm:text-2xl">
            {content.subtitle}
          </p>
        </div>

        {/* Feature Pills */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          style={{
            transform: `translateY(${interpolate(cardsSpring, [0, 1], [30, 0])}px)`,
            opacity: interpolate(cardsSpring, [0, 1], [0, 1]),
          }}
        >
          {content.features.map((feature, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-4 py-2.5 shadow-xs backdrop-blur-sm"
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: DESKCOMM_SAGE[600] }}
              />
              <span className="text-sm font-semibold text-slate-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
