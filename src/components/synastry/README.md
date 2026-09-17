# Synastry bi-wheel V1

Uses `Relationship.calculation` schema 1 / `synastry-major-8-v1`. No additional API,
AI, ephemeris, aspect classification or house assignment is performed.

The common frame places the saved **A ASC on the left**; longitudes increase
counterclockwise. Only valid saved Placidus cusps of A are drawn. Without A ASC,
0° Aries is the left reference and houses are omitted. A MC is independently
displayed only if present. B houses are never mixed into A's geometry. B planets
use their absolute zodiac longitudes in the same frame.

A has filled inner markers; B has outlined outer markers. Exact anchors stay at
their saved longitudes. Each track uses bounded deterministic label lanes and
offsets, then selectable dense groups. All group members keep separate anchors.
Aspect endpoints use exact longitudes on two small central radii (so a conjunction
has a selectable segment). Only saved major planet-to-planet inter-chart aspects
are drawn; angle aspects remain in the existing reference section. Orbs and house
overlays are displayed from snapshot facts, never independently recalculated.

Pure projection, glyphs and formatting are imported from the frozen natal files;
no natal files are modified. Geometry is memoized and independent of viewport.
An SVG viewBox responds to container width without observers or animation loops.
Selection changes highlights/details, not positions. The collapsed aspect list
provides a touch/keyboard alternative for intersecting lines.

`fixtures/relationship.json` is explicitly synthetic QA data: saved A positions
from the natal fixture, synthetic B positions with dense groups, and aspect/overlay
rows exported by the unchanged backend snapshot builder. It is not a real couple.
