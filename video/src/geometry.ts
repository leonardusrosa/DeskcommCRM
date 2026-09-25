/**
 * DeskcommCRM Video Geometry Module
 *
 * Centralizes named raw screenshot target coordinates and provides
 * coordinate-mapping helpers from raw screenshot space to 1620x720
 * browser viewport space.
 */

export interface RawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const SCREENSHOT_STANDARDS = {
  HD_WIDTH: 1920,
  HD_HEIGHT: 1080,
  VIEWPORT_WIDTH: 1620,
  VIEWPORT_HEIGHT: 720,
  AGENDA_SCREENSHOT_WIDTH: 1699,
  AGENDA_SCREENSHOT_HEIGHT: 1236,
} as const;

/**
 * Maps raw screenshot coordinates to the 1620x720 BrowserFrame viewport.
 * Uses exact aspect-ratio scaling based on viewport width vs screenshot width.
 */
export function mapScreenshotToViewport(
  raw: RawRect,
  screenshotWidth: number = SCREENSHOT_STANDARDS.HD_WIDTH,
  viewportWidth: number = SCREENSHOT_STANDARDS.VIEWPORT_WIDTH,
  padding: number = 0
): ViewportRect {
  const scale = viewportWidth / screenshotWidth;
  return {
    left: Math.round(raw.x * scale - padding),
    top: Math.round(raw.y * scale - padding),
    width: Math.round(raw.width * scale + padding * 2),
    height: Math.round(raw.height * scale + padding * 2),
  };
}

/**
 * Scene 1 — Inbox targets (from 1920x1080 inbox.png)
 */
export const INBOX_TARGETS = {
  // Customer message: "Hola, buenos días. Quisiera pedir información..."
  incomingMessageRaw: { x: 560, y: 249, width: 748, height: 73 },
  // Outgoing agent green reply bubble
  agentReplyRaw: { x: 823, y: 333, width: 676, height: 90 },
} as const;

export const INBOX_VIEWPORT_GEOMETRY = {
  // With 2px padding for clean visual framing
  incomingMessage: mapScreenshotToViewport(INBOX_TARGETS.incomingMessageRaw, 1920, 1620, 2),
  agentReply: mapScreenshotToViewport(INBOX_TARGETS.agentReplyRaw, 1920, 1620, 2),
} as const;

/**
 * Scene 2 — CRM targets (from 1920x1080 crm_kanban.png)
 */
export const CRM_TARGETS = {
  // Source card in "Nuevo contacto" ("Carlos Rodríguez — Blanqueamiento dental")
  sourceCardRaw: { x: 289, y: 302, width: 301, height: 187 },
  // Drop slot in "Consulta agendada"
  dropSlotRaw: { x: 1285, y: 302, width: 301, height: 187 },
} as const;

export const CRM_VIEWPORT_GEOMETRY = {
  // 1px padding ensures 100% complete mask coverage over source card borders
  sourceCardMask: mapScreenshotToViewport(CRM_TARGETS.sourceCardRaw, 1920, 1620, 1),
  // Destination highlight framing the target slot
  dropSlot: mapScreenshotToViewport(CRM_TARGETS.dropSlotRaw, 1920, 1620, 0),
} as const;

/**
 * Scene 3 — Agenda targets (from 1699x1236 agenda.png)
 */
export const AGENDA_TARGETS = {
  // Thursday 11h appointment: "Carlos Rodríguez — Consulta inic..."
  thursdayAppointmentRaw: { x: 1090, y: 596, width: 182, height: 22 },
} as const;

export const AGENDA_VIEWPORT_GEOMETRY = {
  // With 3px padding for breathing room around the appointment pill
  thursdayAppointment: mapScreenshotToViewport(
    AGENDA_TARGETS.thursdayAppointmentRaw,
    SCREENSHOT_STANDARDS.AGENDA_SCREENSHOT_WIDTH,
    SCREENSHOT_STANDARDS.VIEWPORT_WIDTH,
    3
  ),
} as const;

/**
 * Scene 4 — Team targets (from 1920x1080 team.png)
 */
export const TEAM_TARGETS = {
  // Dra. Laura Martínez row up to admin role pill
  lauraRoleRowRaw: { x: 240, y: 306, width: 615, height: 53 },
} as const;

export const TEAM_VIEWPORT_GEOMETRY = {
  // 2px padding for clean outline framing around the row
  lauraRoleRow: mapScreenshotToViewport(TEAM_TARGETS.lauraRoleRowRaw, 1920, 1620, 2),
} as const;

/**
 * Scene 5 — Outro targets (from 1920x1080 demo_catalog.png)
 */
export const OUTRO_TARGETS = {
  // Colombia market card inside catalog 2x2 grid
  colombiaCardRaw: { x: 985, y: 431, width: 253, height: 126 },
} as const;

export const OUTRO_VIEWPORT_GEOMETRY = {
  // Tightly hugs Colombia card in actual rendered composition (card: vp 833,268 to 1046,373 with 2px padding)
  colombiaCard: {
    left: 831,
    top: 266,
    width: 218,
    height: 110,
  },
} as const;


