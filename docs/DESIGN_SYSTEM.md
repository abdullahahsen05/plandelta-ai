# Design System

## Direction

PlanDelta should feel like a precise construction review instrument: editorial,
technical, quiet, and trustworthy. The blueprint is the visual hero. Interface
chrome supports it rather than competing with it.

## Visual language

- Warm limestone canvas: #F3F0E8
- Paper surface: #FBFAF6
- Graphite ink: #171A1C
- Muted ink: #646762
- Hairline border: #D8D4CA
- Signal orange brand accent: #E6532F
- Focus ring: #1E62D0
- Added semantic: #17845B
- Removed semantic: #C53F3F
- Modified semantic: #D88916
- Blueprint viewer navy: #10263B

Added/removed/modified colors are data semantics. Signal orange remains the
only brand accent.

## Typography

- Primary UI: Host Grotesk or another bundled open, non-default grotesk with
  strong numeral legibility.
- Technical values: IBM Plex Mono.
- Do not default to Inter, Roboto, or Open Sans.
- Use restrained scale and strong hierarchy rather than oversized hero text.

Suggested desktop scale:

- Display: 56/58, weight 550
- H1: 38/42, weight 560
- H2: 28/34, weight 560
- H3: 20/26, weight 600
- Body: 15/23
- Small: 13/19
- Label: 11/16, weight 650, modest tracking
- Mono measurement: 12/18

## Layout

- Marketing max width: 1280px.
- Application uses the viewport with a compact 56px top bar.
- Workbench desktop:
  - left revision rail: 240px
  - central canvas: flexible
  - right change ledger: 340px
- Use 1px separators instead of wrapping every area in cards.
- Border radius: 4px controls, 8px panels, 12px only for major surfaces.
- Base spacing unit: 4px; common gaps 8, 12, 16, 24, 32, 48, 72.

## Required routes

- / — product story and interactive sample entry
- /app — projects
- /app/projects/new
- /app/projects/[projectId]
- /app/analyses/[analysisId] — primary workbench
- /auth/sign-in

## Workbench

Top bar:

- Project/revision breadcrumb
- Analysis status and engine version
- Overlay controls
- Export action

Left rail:

- Baseline and candidate sheets
- Page and revision metadata
- Alignment quality

Center:

- React Konva blueprint canvas
- Pan, zoom, fit, split, swipe, blink, and opacity modes
- Regions rendered with semantic color and selected evidence state
- Minimap only if it improves navigation

Right ledger:

- Compact filter row
- Ordered changes with category, type, confidence, affected trades, and OCR
- Selecting a row focuses the canvas; selecting a region focuses the row
- Detail drawer/panel shows old crop, new crop, text, metrics, and impact

## Motion

- Use Motion for state continuity, not decoration.
- 120–180ms for controls; 220–320ms for panel transitions.
- Canvas zoom and selection should feel immediate.
- No continuous floating objects or scroll hijacking.
- Respect prefers-reduced-motion.

## Content

- Use construction language: revision, sheet, linework, evidence, affected
  trade, alignment, confidence, baseline, candidate.
- Never claim exact cost or guaranteed takeoff accuracy.
- Explain uncertainty plainly.
- Errors should tell users how to recover.

## Anti-patterns

- No three generic benefit cards.
- No fake customer logos, fake testimonials, or invented accuracy percentages.
- No excessive pills, gradients, glow, glass, or 24px rounded containers.
- No icon on every sentence.
- No empty right side of the hero; use a genuine annotated blueprint preview.
- No hardcoded analysis animation pretending to process user data.

## Accessibility

- WCAG AA color contrast.
- Visible focus and complete keyboard navigation.
- Canvas changes also exist in an accessible ledger.
- Do not encode change type by color alone; use patterns/labels/icons.
- Minimum 40px interactive target where practical.
- Announce job progress without excessive screen-reader noise.
