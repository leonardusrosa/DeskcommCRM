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
    treatmentTag: string;
    specialistLabel: string;
    handoffBadge: string;
    doctorName: string;
    channelBadge: string;
  };
  crm: SceneText & {
    pipelineName: string;
    stageFrom: string;
    stageTo: string;
    dealName: string;
    dealValue: string;
    dealPhone: string;
    movingLabel: string;
    timeLabel: string;
    nextActionTitle: string;
    nextActionSubtitle: string;
    nextActionBadge: string;
  };
  agenda: SceneText & {
    dateText: string;
    appointmentTitle: string;
    specialistText: string;
    statusConfirmed: string;
    notificationTitle: string;
    notificationSubtitle: string;
    notificationBadge: string;
  };
  team: SceneText & {
    coordinationTitle: string;
    coordinationSubtitle: string;
    coordinationBadge: string;
    accessControlTitle: string;
    accessControlSubtitle: string;
    accessControlBadge: string;
    accountabilityTag: string;
  };
  outro: {
    badge: string;
    headline: string;
    subtitle: string;
    ctaButton: string;
    features: string[];
    url: string;
    launchingText: string;
    oneClickBadge: string;
  };
}

export interface DemoVideoProps {
  lang?: Language;
}
