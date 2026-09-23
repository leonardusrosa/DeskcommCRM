import React from 'react';
import { Composition, Folder } from 'remotion';
import { getLocalizedContent } from './content';
import {
  DeskcommProductDemo,
  SCENE_DURATIONS,
  TOTAL_VIDEO_FRAMES,
} from './DeskcommProductDemo';
import './index.css';
import { SceneAgenda } from './scenes/SceneAgenda';
import { SceneCRM } from './scenes/SceneCRM';
import { SceneInbox } from './scenes/SceneInbox';
import { SceneIntro } from './scenes/SceneIntro';
import { SceneOutro } from './scenes/SceneOutro';
import { SceneTeam } from './scenes/SceneTeam';
import { DemoVideoProps } from './types';

const defaultContentES = getLocalizedContent('es');

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Primary 1080p Product Demo Videos */}
      <Composition
        id="DeskcommProductDemoES"
        component={DeskcommProductDemo}
        durationInFrames={TOTAL_VIDEO_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ lang: 'es' } as DemoVideoProps}
      />

      <Composition
        id="DeskcommProductDemoPT"
        component={DeskcommProductDemo}
        durationInFrames={TOTAL_VIDEO_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ lang: 'pt' } as DemoVideoProps}
      />

      <Composition
        id="DeskcommProductDemoEN"
        component={DeskcommProductDemo}
        durationInFrames={TOTAL_VIDEO_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ lang: 'en' } as DemoVideoProps}
      />

      {/* Individual Scene Compositions for Studio inspection & editing */}
      <Folder name="Individual-Scenes">
        <Composition
          id="Scene0-Intro"
          component={() => <SceneIntro content={defaultContentES.intro} />}
          durationInFrames={SCENE_DURATIONS.intro}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene1-Inbox"
          component={() => <SceneInbox content={defaultContentES.inbox} />}
          durationInFrames={SCENE_DURATIONS.inbox}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene2-CRM"
          component={() => <SceneCRM content={defaultContentES.crm} />}
          durationInFrames={SCENE_DURATIONS.crm}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene3-Agenda"
          component={() => <SceneAgenda content={defaultContentES.agenda} />}
          durationInFrames={SCENE_DURATIONS.agenda}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene4-Team"
          component={() => <SceneTeam content={defaultContentES.team} />}
          durationInFrames={SCENE_DURATIONS.team}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene5-Outro"
          component={() => <SceneOutro content={defaultContentES.outro} />}
          durationInFrames={SCENE_DURATIONS.outro}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
