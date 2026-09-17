// Bi-wheel geometry owns its radii/layout; natal's pure projection stays unchanged.
import { normalizeDegrees, project } from '../natal/geometry';

export const CENTER = { x: 360, y: 360 };
export const TRACKS = { A: { anchor: 230, lanes: [194, 158], aspect: 96 }, B: { anchor: 307, lanes: [278, 262], aspect: 108 } };
export const pointAt = (longitude, reference, radius) => project(longitude, reference, radius, CENTER);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function layoutTrack(points, person, reference) {
  const track = TRACKS[person];
  const anchors = points.filter(point => point.person === person).map(point => ({ ...point, ...pointAt(point.longitude, reference, track.anchor) }));
  const labels = [];
  for (const point of [...anchors].sort((a, b) => a.longitude - b.longitude || a.id.localeCompare(b.id, 'en'))) {
    let placed;
    for (const offset of [0, 6, -6, 12, -12, 18, -18]) {
      for (const radius of track.lanes) {
        const displayLongitude = normalizeDegrees(point.longitude + offset);
        const position = pointAt(displayLongitude, reference, radius);
        if (labels.every(label => distance(label, position) >= 68)) {
          placed = { id: point.id, person, members: [point.id], displayLongitude, radius, ...position };
          break;
        }
      }
      if (placed) break;
    }
    if (placed) labels.push(placed);
    else {
      // A bounded cluster, not an unbounded angular shove. Every member keeps its exact anchor.
      const nearest = [...labels].sort((a, b) => distance(a, point) - distance(b, point) || a.id.localeCompare(b.id, 'en'))[0];
      nearest.members.push(point.id);
    }
  }
  return { anchors, labels };
}

export function layoutSynastry(model) {
  const tracks = ['A', 'B'].map(person => layoutTrack(model.points, person, model.reference));
  return { anchors: tracks.flatMap(track => track.anchors), labels: tracks.flatMap(track => track.labels),
    aspects: model.aspects.map(aspect => ({ ...aspect,
      start: pointAt(model.byId[aspect.from].longitude, model.reference, TRACKS[model.byId[aspect.from].person].aspect),
      end: pointAt(model.byId[aspect.to].longitude, model.reference, TRACKS[model.byId[aspect.to].person].aspect),
    })) };
}
