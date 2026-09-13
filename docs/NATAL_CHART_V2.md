# Natal Chart Visualization V2

## Data and renderer audit

The former imperative D3 renderer estimated zodiac boundaries from the planets
present in a sign, drew house annotations through multiple passes, and displaced
glyphs without separate exact-position markers. Pattern diagrams used arbitrary
regular polygons. The replacement uses React, JavaScript and one SVG scene.

The existing API provides:

- `bodies_for_circle`: symbols, names, absolute `degree`, sign, house and retrograde.
  ASC/DSC (`AS`/`DS`), MC and IC have their own longitudes. Optional nodes,
  Chiron and other points are rendered only when present.
- `houses`: twelve ordered absolute cusp longitudes. Current backend uses Placidus.
- `aspects_for_circle`: existing pairs and aspect symbols.
- `aspects_structured`: backend-formatted orb strings. The adapter matches these
  by unordered pair and aspect type, preserving the supplied orb text.
- `patterns_data`: existing pattern types and members. Focus uses those members
  and their existing aspects; stelliums receive cluster arcs, not fake polygons.
- `house_system`: displayed as supplied.

Numeric orb, applying/separating, max-orb settings and per-chart zodiac mode are
not supplied. Missing or ambiguous orbs are reported as unavailable. No orb
threshold, aspect detector, pattern detector, ephemeris or house calculator is
implemented in the frontend. Missing mandatory geometry produces an explanation
while existing textual details remain available.

## Geometry and layout

All rings, cusps, anchors, angles and aspect endpoints use:

```
normalize(x) = ((x % 360) + 360) % 360
delta = normalize(longitude - ascLongitude)
screenAngle = 180 - delta
x = cx + r * cos(screenAngle * PI / 180)
y = cy + r * sin(screenAngle * PI / 180)
```

The viewBox is 600 × 600 with center (300, 300). ASC is exactly left; ASC + 90°
is below. MC is projected from its own API longitude, never forced to the top.
Zodiac sectors are exactly 30°. House rays follow the twelve supplied cusps and
retain their unequal widths.

Label layout sorts by longitude and stable ID, uses three bounded radial lanes
and at most 18° of display offset, checks label/house-number bounds, and groups
overflowing labels. Original anchors never move. Each member retains a true tick
and leader; group selection highlights its members and offers individual buttons.
Aspects project original longitudes onto the inner ring independently of labels.
Conjunctions have a short curved marker; other aspects are straight chords.

Major/all/none visibility, muted colors and distinct dash/width styles limit
clutter. Hover, keyboard focus and pinned selection expose exact values; Enter,
Space, Escape and outside tap are supported. Text lists provide another way to
read and select all points, houses and aspects. Compact layouts enlarge glyphs,
angle/house labels, omit 1° ticks and hide degree text. ResizeObserver changes
presentation only; normalized data and geometry are memoized.

## Fixture and verification

`src/components/natal/fixtures/api-placidus.json` is fixed output from the existing
backend Ephemeris/Aspects/NatalChartResponse adapters for synthetic input
2000-01-02 12:30 UTC, longitude 30°, latitude 50°. Optional outbound JPL lookup was
disabled during export. It contains 20 points, 12 real Placidus cusps and 137
aspects. It is not a personal production record. The landing labels it as an
example. Tests use fixed expected pixel coordinates, not live ephemeris calls.

Final local validation:

- 120 tests passed across all 12 frontend suites, including geometry, immutable
  anchors, orb mapping, dense-group highlighting and existing behavioral tests.
- Production build successful.
- Browser QA: 360×800, 390×844, 768×1024 and 1440×900. No horizontal overflow;
  responsive square SVG, visible angle labels and bounded cards/popovers.
- Normal fixture, all 137 aspects, point/aspect selection, keyboard clear,
  outside clear, dense groups and supplied-pattern focus inspected.
- Dense/pattern QA uses an explicitly synthetic adversarial rendering fixture;
  it does not claim to be another calculated natal chart.
- Result page, saved-chart opening, creation form, chat history/input and landing
  preview checked with local API fixtures. Existing creation/auth/usage/chat
  behavioral suites pass. No paid AI calls are needed for renderer verification.
- Screenshots are local QA artifacts in the workspace's
  `.ai-validation/wheel-v2-screenshots/`, intentionally excluded from this commit.

Backend, database, API contracts, environment and payment configuration are unchanged.
