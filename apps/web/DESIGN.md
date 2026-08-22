# Meridian Design System 2.0 — Foundation

## Direction
Premium digital travel atlas: precise, calm, atmospheric and modern.

## Principles
1. Functional before decorative.
2. Deep midnight surfaces with restrained cyan accents.
3. Fine borders and soft depth instead of heavy glass everywhere.
4. Motion communicates state or hierarchy; it does not decorate every element.
5. Reduced-motion preferences are respected.
6. Avoid AI-site clichés: excessive gradients, random blobs and unrelated component styles.

## Core tokens
- Background: `#050B12`
- Surface: `#08131D`
- Raised surface: `#0B1824`
- Accent: `#7DD3FC`
- Accent strong: `#38BDF8`
- Foreground: `#EEF6FF`
- Muted: `#7F91A6`
- Border: `rgba(255,255,255,.08)`

## Radius
- Controls: 12px
- Cards: 20–28px
- Pills: 999px

## Motion
Use Motion for React for:
- page/section entry
- modal presence
- meaningful layout changes
- realtime feedback
- small tactile button interactions

Use CSS transitions for:
- color
- border
- simple hover states

Default enter motion:
- opacity 0 → 1
- y 12–16px → 0
- ~450ms
- ease `[0.22, 1, 0.36, 1]`

## Auth UX
- Password fields always support show/hide.
- Validation is immediate but not noisy.
- Submit states use clear progressive labels.
- No fake Google button before Google Identity is wired.
- Social auth and MFA are separate concerns.
