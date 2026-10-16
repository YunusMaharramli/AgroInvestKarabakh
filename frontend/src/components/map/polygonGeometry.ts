/** Geographic coordinates in GeoJSON order. Rings may include a closing point. */
export type BoundaryPath = [number, number][];
type Point = [number, number];

// Coordinates are rounded to six decimals by the drawing UI. This tolerance is
// much smaller, while still absorbing floating point error at shared borders.
const EPSILON = 1e-9;
const cross = (a: Point, b: Point): number => a[0] * b[1] - a[1] * b[0];
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const length = (a: Point): number => Math.hypot(a[0], a[1]);
const samePoint = (a: Point, b: Point): boolean => length(subtract(a, b)) <= EPSILON;

function openRing(path: BoundaryPath): BoundaryPath {
  return path.length > 1 && samePoint(path[0], path[path.length - 1]) ? path.slice(0, -1) : path;
}

function onSegment(point: Point, a: Point, b: Point): boolean {
  const edge = subtract(b, a);
  return Math.abs(cross(edge, subtract(point, a))) <= EPSILON * length(edge)
    && point[0] >= Math.min(a[0], b[0]) - EPSILON && point[0] <= Math.max(a[0], b[0]) + EPSILON
    && point[1] >= Math.min(a[1], b[1]) - EPSILON && point[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function orientation(a: Point, b: Point, point: Point): number {
  const edge = subtract(b, a);
  const value = cross(edge, subtract(point, a));
  return Math.abs(value) <= EPSILON * length(edge) ? 0 : Math.sign(value);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c), abD = orientation(a, b, d);
  const cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  return (abC === 0 && onSegment(c, a, b)) || (abD === 0 && onSegment(d, a, b))
    || (cdA === 0 && onSegment(a, c, d)) || (cdB === 0 && onSegment(b, c, d))
    || (abC * abD < 0 && cdA * cdB < 0);
}

/** Reject crossings, touching non-adjacent edges, retraced edges and zero area. */
export function isSimplePolygon(path: BoundaryPath): boolean {
  if (path.some(point => point.length !== 2 || !point.every(Number.isFinite))) return false;
  const ring = openRing(path);
  if (ring.length < 3) return false;
  let twiceArea = 0, perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], c = ring[(i + 2) % ring.length];
    if (samePoint(a, b) || onSegment(c, a, b) || onSegment(a, b, c)) return false;
    twiceArea += cross(subtract(a, ring[0]), subtract(b, ring[0]));
    perimeter += length(subtract(b, a));
    for (let j = i + 1; j < ring.length; j++) {
      if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
      if (segmentsIntersect(a, b, ring[j], ring[(j + 1) % ring.length])) return false;
    }
  }
  return Math.abs(twiceArea) > EPSILON * perimeter;
}

/** Includes the boundary, allowing a selection to share the parcel's border. */
function pointInRing(point: Point, ring: BoundaryPath): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Parameters of intersections along a→b, including collinear overlap ends. */
function intersectionParameters(a: Point, b: Point, c: Point, d: Point): number[] {
  const edge = subtract(b, a), border = subtract(d, c), offset = subtract(c, a);
  const edgeLength = length(edge), borderLength = length(border);
  const denominator = cross(edge, border);
  const tolerance = EPSILON / edgeLength;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  if (Math.abs(denominator) <= EPSILON * (edgeLength + borderLength)) {
    if (Math.abs(cross(edge, offset)) > EPSILON * edgeLength) return [];
    const squaredLength = edgeLength * edgeLength;
    return [c, d].map(point => {
      const delta = subtract(point, a);
      return (delta[0] * edge[0] + delta[1] * edge[1]) / squaredLength;
    }).filter(value => value >= -tolerance && value <= 1 + tolerance).map(clamp);
  }
  const t = cross(offset, border) / denominator;
  const u = cross(offset, edge) / denominator;
  return t >= -tolerance && t <= 1 + tolerance && u >= -EPSILON / borderLength && u <= 1 + EPSILON / borderLength
    ? [clamp(t)] : [];
}

/**
 * Check the entire selection against a simple outer ring. Testing corners alone
 * misses edges that cut across a concave parcel's notch. Split every drawn edge
 * at parcel intersections and check each interval, including vertex tangencies.
 */
export function polygonContainedByRing(selection: BoundaryPath, parcel: BoundaryPath): boolean {
  if (!isSimplePolygon(selection) || !isSimplePolygon(parcel)) return false;
  const selectedRing = openRing(selection), parcelRing = openRing(parcel);
  if (!selectedRing.every(point => pointInRing(point, parcelRing))) return false;
  for (let i = 0; i < selectedRing.length; i++) {
    const a = selectedRing[i], b = selectedRing[(i + 1) % selectedRing.length];
    const parameters = [0, 1];
    for (let j = 0; j < parcelRing.length; j++) {
      parameters.push(...intersectionParameters(a, b, parcelRing[j], parcelRing[(j + 1) % parcelRing.length]));
    }
    parameters.sort((left, right) => left - right);
    const edge = subtract(b, a), tolerance = EPSILON / length(edge);
    for (let j = 1; j < parameters.length; j++) {
      if (parameters[j] - parameters[j - 1] <= tolerance) continue;
      const midpoint = (parameters[j] + parameters[j - 1]) / 2;
      if (!pointInRing([a[0] + edge[0] * midpoint, a[1] + edge[1] * midpoint], parcelRing)) return false;
    }
  }
  return true;
}
