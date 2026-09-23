export type Language = 'es' | 'pt' | 'en';

export interface SceneText {
  badge: string;
  headline: string;
  subtitle: string;
  callout?: string;
  extra?: string[];
}

export interface VideoContent {
  intro: {
    badge: string;
    title: string;
    subtitle: string;
    features: string[];
  };
  inbox: SceneText & {
    patientName: string;
    patientMessage: string;
    agentResponse: string;
    patientReply: string;
    doctorName: string;
  };
  crm: SceneText & {
    pipelineName: string;
    stageFrom: string;
    stageTo: string;
    dealName: string;
    dealValue: string;
  };
  agenda: SceneText & {
    dateText: string;
    appointmentTitle: string;
    specialistText: string;
    statusConfirmed: string;
  };
  team: SceneText & {
    roleAdmin: string;
    roleAgent: string;
    accountabilityTag: string;
  };
  outro: {
    badge: string;
    headline: string;
    subtitle: string;
    ctaButton: string;
    features: string[];
    url: string;
  };
}

export interface DemoVideoProps {
  lang?: Language;
}
