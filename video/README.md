# DeskcommCRM — Remotion Product Demo Video

Remotion-powered programmatic product-demo video for **DeskcommCRM**.
Engineered to introduce leads to the real Deskcomm product workflow before entering the unattended interactive synthetic demo.

## Product Narrative Flow (~70 seconds @ 30fps)

1. **Intro (0:00 - 0:05)**: Value proposition — *"De la primera conversación a la próxima acción"*.
2. **Scene 1 · Inbox (0:05 - 0:19)**: Synthetic patient conversation, WhatsApp incoming channel, patient history, clinical tags, agile handoff.
3. **Scene 2 · CRM (0:19 - 0:34)**: Real-time opportunity progression, treatment pipeline, dragging deal card across stages.
4. **Scene 3 · Agenda (0:34 - 0:49)**: Confirmed appointments, doctor schedule columns, patient follow-up. Suppresses Google OAuth infra warnings in demo mode.
5. **Scene 4 · Team (0:49 - 1:01)**: Role hierarchy (`Papel / Rol`), interface permissions, team coordination without duplication.
6. **Scene 5 · Outro / CTA (1:01 - 1:10)**: 1-click interactive demo CTA across CO, MX, ES, and PT without login or credit card.

## Brand Tokens

The video strictly adheres to the canonical **Deskcomm Sage** palette defined in `app/globals.css`:

- **Primary Light Accent**: `#506d48` (`--color-accent-600`)
- **Dark Mode Accent**: `#82a077` (`--color-accent-400`)
- **Hover / Deep Accent**: `#41573b` (`--color-accent-700`)
- **Soft Backgrounds**: `#f3f6f1` (50), `#e4ebe0` (100)
- **Token Mirror**: `video/src/theme.ts` (validated against `app/globals.css` by `tests/unit/video-theme-palette.test.ts`).

## Rendering

```bash
# In the video/ directory:

# Spanish 1080p
npx remotion render DeskcommProductDemoES out/demo_es.mp4

# Portuguese 1080p
npx remotion render DeskcommProductDemoPT out/demo_pt.mp4

# Poster frame
npx remotion still DeskcommProductDemoES out/poster.png --frame=75
```
