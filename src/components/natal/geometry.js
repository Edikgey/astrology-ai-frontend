// Projection and label layout only. No ephemeris, house assignment or aspect detection.
export const CENTER = { x: 300, y: 300 };
export const RADII = { outer: 270, zodiacInner: 240, anchor: 228, houses: 104, aspect: 88, angleLabel: 280 };
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

export function longitudeToScreenAngle(longitude, ascLongitude) {
  return 180 - normalizeDegrees(longitude - ascLongitude);
}

export function polarToCartesian(angle, radius, center = CENTER) {
  const radians = angle * Math.PI / 180;
  return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) };
}

export function project(longitude, asc, radius, center = CENTER) {
  return polarToCartesian(longitudeToScreenAngle(longitude, asc), radius, center);
}

export function buildHouseSectors(cusps, asc, radius = RADII.anchor) {
  return cusps.map((cusp, index) => {
    const next = cusps[(index + 1) % cusps.length];
    const span = normalizeDegrees(next.longitude - cusp.longitude);
    return { ...cusp, span, start: project(cusp.longitude, asc, radius),
      end: project(next.longitude, asc, radius),
      label: project(cusp.longitude + span / 2, asc, RADII.houses),
      midLongitude: normalizeDegrees(cusp.longitude + span / 2) };
  });
}

export function buildPlanetAnchors(points, asc, radius = RADII.anchor) {
  return points.map(point => ({ id: point.id, longitude: point.longitude,
    anchor: project(point.longitude, asc, radius) }));
}

const compareId = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const angularDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

export function layoutPlanetLabels(anchors, asc, { compact = false, degrees = false, obstacles = [] } = {}) {
  // Three bounded lanes; no true longitude or anchor is ever modified.
  const radii = [210, 170, 130];
  const width = compact ? 41 : 29;
  const clearance = width + 7;
  const sorted = [...anchors].sort((a, b) => normalizeDegrees(a.longitude) - normalizeDegrees(b.longitude) || compareId(a.id, b.id));
  const labels = [];
  for (const point of sorted) {
    let placed;
    for (let lane = 0; lane < radii.length && !placed; lane += 1) {
      const radius = radii[lane];
      const minAngle = 2 * Math.asin(clearance / (2 * radius)) * 180 / Math.PI;
      // At most 18 degrees of display displacement; finite and deterministic.
      const step = Math.min(6, minAngle / 2);
      const offsets = [0];
      for (let offset = step; offset <= 18; offset += step) offsets.push(offset, -offset);
      for (const offset of offsets) {
        const displayLongitude = normalizeDegrees(point.longitude + offset);
        const position = project(displayLongitude, asc, radius);
        const bounds = { left: position.x - (degrees && !compact ? 25 : width / 2 + 4), right: position.x + (degrees && !compact ? 25 : width / 2 + 4),
          top: position.y - (degrees && !compact ? 34 : width / 2 + 4), bottom: position.y + width / 2 + 4 };
        const separate = other => bounds.right <= other.left || bounds.left >= other.right || bounds.bottom <= other.top || bounds.top >= other.bottom;
        if (labels.every(label => separate(label.bounds)) && obstacles.every(separate)) {
          placed = { id: point.id, members: [point.id], displayLongitude, lane, radius, width, bounds, ...position };
          break;
        }
      }
    }
    if (placed) labels.push(placed);
    else {
      // An overcrowded cluster remains selectable as a compact group. Its members
      // retain separate exact ticks and aspect endpoints; no point is discarded.
      const nearest = [...labels].sort((a, b) => angularDistance(a.displayLongitude, point.longitude) - angularDistance(b.displayLongitude, point.longitude) || compareId(a.id, b.id))[0];
      nearest.members.push(point.id);
    }
  }
  return labels;
}

export function buildAspectEndpoints(aspects, pointsById, asc, radius = RADII.aspect) {
  return aspects.filter(aspect => pointsById[aspect.from] && pointsById[aspect.to]).map(aspect => ({ ...aspect,
    start: project(pointsById[aspect.from].longitude, asc, radius),
    end: project(pointsById[aspect.to].longitude, asc, radius),
  }));
}

export function arcPath(startLongitude, span, asc, radius) {
  const start = project(startLongitude, asc, radius);
  const end = project(startLongitude + span, asc, radius);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} 0 ${end.x} ${end.y}`;
}

export function sectorPath(startLongitude, span, asc, radius) {
  return `${arcPath(startLongitude, span, asc, radius)} L 300 300 Z`;
}
