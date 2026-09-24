import React from 'react';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { useCurrentFrame } from 'remotion';
import { StoryProgress } from './components/StoryProgress';
import { getLocalizedContent } from './content';
import { SceneAgenda } from './scenes/SceneAgenda';
import { SceneCRM } from './scenes/SceneCRM';
import { SceneInbox } from './scenes/SceneInbox';
import { SceneIntro } from './scenes/SceneIntro';
import { SceneOutro } from './scenes/SceneOutro';
import { SceneTeam } from './scenes/SceneTeam';
import { DemoVideoProps } from './types';

export const SCENE_DURATIONS = {
  intro: 150,
  inbox: 420,
  crm: 450,
  agenda: 450,
  team: 360,
  outro: 330,
  transition: 15,
};

export const TOTAL_VIDEO_FRAMES =
  SCENE_DURATIONS.intro +
  SCENE_DURATIONS.inbox +
  SCENE_DURATIONS.crm +
  SCENE_DURATIONS.agenda +
  SCENE_DURATIONS.team +
  SCENE_DURATIONS.outro -
  5 * SCENE_DURATIONS.transition; // 2085 frames = 69.5 seconds @ 30fps

export const DeskcommProductDemo: React.FC<DemoVideoProps> = ({ lang = 'es' }) => {
  const frame = useCurrentFrame();
  const content = getLocalizedContent(lang);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-slate-900 font-sans antialiased overflow-hidden">
      <TransitionSeries>
        {/* Intro */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.intro}>
          <SceneIntro content={content.intro} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: SCENE_DURATIONS.transition })}
        />

        {/* Scene 1: Inbox */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.inbox}>
          <SceneInbox content={content.inbox} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: SCENE_DURATIONS.transition })}
        />

        {/* Scene 2: CRM */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.crm}>
          <SceneCRM content={content.crm} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: SCENE_DURATIONS.transition })}
        />

        {/* Scene 3: Agenda */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.agenda}>
          <SceneAgenda content={content.agenda} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: SCENE_DURATIONS.transition })}
        />

        {/* Scene 4: Team */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.team}>
          <SceneTeam content={content.team} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: SCENE_DURATIONS.transition })}
        />

        {/* Scene 5: Outro / Try interactive demo */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.outro}>
          <SceneOutro content={content.outro} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Floating Story Progress indicator */}
      <StoryProgress currentFrame={frame} />
    </div>
  );
};
