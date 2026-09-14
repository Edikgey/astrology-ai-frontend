# Lunaria application theme

`src/theme.css` is the single source for `--ln-*` color, typography, spacing,
radius, elevation, stacking and motion tokens. Application component styles use
semantic tokens; layout dimensions, breakpoints, font weights and line heights
retain their existing values. The spacing scale is 4/8/12/16/24/32/48/64px;
off-scale existing paddings/gaps stay explicit to avoid a layout redesign.

## Frozen natal rendering

Do not modify `src/components/natal/*`, `NatalChart.js`, `NatalChart.css`,
`AspectsList.*`, or `PatternVisualizer.*` as part of an application theme pass.
Their code, tests and styles remain unchanged. In `HomePage.css`, the existing
`.hero-preview .chart-preview` and `.hero-preview .responsive-svg` rules are also
frozen, including their dimensions, margins, white background and circle radius.

The pre-existing global baseline in `index.css` uses centralized `--ln-legacy-*`
values. Compatibility variable names in `theme.css` preserve the values consumed
by frozen chart styles. New global theme overrides use zero-specificity exclusions
for `.chart-v2`, `.chart-preview`, `.chart-summary`, `.chart-details` and their
descendants. Chat can therefore receive the application theme even when rendered
as a child of `NatalChart`. No geometry or rendering calculations change.

The baseline's existing reduced-motion rule is preserved; the new decorative
button transitions are separately scoped away from the renderer. Google-owned
button descendants are excluded from new global overrides.

## Intentional raw-style exceptions

- Frozen renderer styles and visual constants, including legacy pattern SVGs.
- The frozen `.hero-preview .responsive-svg` rule in `HomePage.css`.
- Vendor-rendered Google/Paddle UI and static assets are outside the theme scope.
- Existing layout measurements and frozen global baseline radii/transitions remain
  exact where changing them could affect chart controls. New theme values use tokens.

## Before deployment

Review auth/Google controls, selected location and validation states, pricing's
featured card, saved-chart cards, chat bubbles/composer, dialogs and footer on a
phone and desktop. Check keyboard focus, modal contrast and the unmodified natal
wheel against its new surrounding shell. No backend or auth/payment behavior is
changed by these CSS files.
