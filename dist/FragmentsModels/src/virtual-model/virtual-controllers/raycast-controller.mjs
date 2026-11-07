import * as THREE from "three";
import { SnappingClass, CurrentLod } from "../../model/model-types.mjs";
import { Representation } from "../../../../Schema/representation.mjs";
import { Sample } from "../../../../Schema/sample.mjs";
import { TransformHelper } from "../../utils/geometry/transform-helper.mjs";
import { PlanesUtils } from "../../utils/geometry/planes-utils.mjs";
import { CameraUtils } from "../../utils/geometry/camera-utils.mjs";
import { MiscHelper } from "../../utils/misc/misc-helper.mjs";
class RaycastController {
  _meshes;
  _model;
  _boxes;
  _tiles;
  _items;
  _edgeThreshold = 8;
  _raycastMultiplier = 32;
  _maxDuration = 512;
  _precission = 1e-3;
  _temp = {
    sample: new Sample(),
    representation: new Representation(),
    tempPlane: new THREE.Plane(),
    ray: new THREE.Ray(),
    frustum: new THREE.Frustum(),
    m1: new THREE.Matrix4(),
    m2: new THREE.Matrix4(),
    m3: new THREE.Matrix4(),
    v1: new THREE.Vector3(),
    planes: []
  };
  constructor(model, boxes, tiles, items) {
    this._model = model;
    this._boxes = boxes;
    this._tiles = tiles;
    this._items = items;
    this._meshes = model.meshes();
  }
  static cast(mesh, representation, ray, frustum, snap) {
    const reprId = representation.id();
    if (snap === SnappingClass.FACE) {
      return mesh.faceRaycast(reprId, ray, frustum);
    }
    if (snap === SnappingClass.LINE) {
      return mesh.lineRaycast(reprId, ray, frustum);
    }
    if (snap === SnappingClass.POINT) {
      return mesh.pointRaycast(reprId, ray, frustum);
    }
    if (snap === void 0) {
      return mesh.raycast(reprId, ray, frustum);
    }
    return void 0;
  }
  raycast(ray, frustum, planes, returnAll) {
    const data = { ray, frustum, planes, returnAll };
    const ids = this.castBox(frustum, planes);
    if (ids.length) {
      return this.computeRaycastList(ids, data);
    }
    return null;
  }
  snapRaycast(ray, frustum, snaps, planes) {
    const results = [];
    const data = { ray, frustum, planes };
    const first = this.raycast(ray, frustum, planes);
    if (!first) {
      return this.snapCastEdges(data, snaps);
    }
    this.getSnaps(first, data, snaps, results);
    if (!first.normal) {
      return results;
    }
    return this.filterOnFront(results);
  }
  rectangleRaycast(frustum, planes, fullyInside) {
    const lookup = this._boxes.lookup;
    if (!lookup) {
      return [];
    }
    const itemIds = lookup.collideFrustum(planes, frustum, false);
    let raycastedItemIds = this.filterVisible(itemIds);
    if (raycastedItemIds.length) {
      raycastedItemIds = this.narrowPhaseFrustum(
        raycastedItemIds,
        frustum,
        planes,
        fullyInside
      );
    }
    return this.localIdsFromItemIds(raycastedItemIds);
  }
  // Filters broad-phase sample candidates by testing their real geometry
  // against the selection frustum (+ clipping planes). Mirrors the section/clip
  // generator: builds a transient BVH per representation (cached for this call)
  // and shapecasts it; the frustum is moved into each sample's local space so
  // instanced items that share one local geometry are handled by transform.
  // fullyInside === true keeps only items whose geometry is entirely inside;
  // false keeps items whose geometry touches the selection.
  narrowPhaseFrustum(sampleIds, frustum, clipPlanes, fullyInside) {
    const worldPlanes = clipPlanes && clipPlanes.length ? [...frustum.planes, ...clipPlanes] : frustum.planes;
    const geomCache = /* @__PURE__ */ new Map();
    const result = [];
    const start = performance.now();
    let exceeded = false;
    for (const sampleId of sampleIds) {
      if (exceeded) {
        result.push(sampleId);
        continue;
      }
      const box = this._boxes.get(sampleId);
      if (CameraUtils.isIncluded(box, worldPlanes)) {
        result.push(sampleId);
        continue;
      }
      if (this.sampleMatchesFrustum(
        sampleId,
        frustum,
        clipPlanes,
        fullyInside,
        geomCache
      )) {
        result.push(sampleId);
      }
      exceeded = this.isTimeExceeded(start);
    }
    for (const [, geometries] of geomCache) {
      for (const geometry of geometries) {
        geometry.disposeBoundsTree?.();
        geometry.dispose();
      }
    }
    return result;
  }
  sampleMatchesFrustum(sampleId, frustum, clipPlanes, fullyInside, geomCache) {
    const sample = this._meshes.samples(sampleId, this._temp.sample);
    if (!sample) return !fullyInside;
    const reprId = sample.representation();
    TransformHelper.get(this._temp.sample, this._meshes, this._temp.m1);
    this._temp.m2.copy(this._temp.m1).invert();
    let geometries = geomCache.get(reprId);
    if (!geometries) {
      geometries = this.buildSampleGeometries(sampleId);
      geomCache.set(reprId, geometries);
    }
    if (geometries.length === 0) return !fullyInside;
    const localPlanes = this.toLocalPlanes(frustum, clipPlanes, this._temp.m2);
    if (fullyInside) {
      for (const geometry of geometries) {
        if (!this.geometryFullyInside(geometry, localPlanes)) {
          return false;
        }
      }
      return true;
    }
    for (const geometry of geometries) {
      if (this.geometryIntersectsPlanes(geometry, localPlanes)) {
        return true;
      }
    }
    return false;
  }
  // True only if every vertex of the geometry is inside every plane.
  geometryFullyInside(geometry, planes) {
    const position = geometry.getAttribute("position");
    const array = position.array;
    const vertex = this._temp.v1;
    for (let i = 0; i < array.length; i += 3) {
      vertex.set(array[i], array[i + 1], array[i + 2]);
      for (const plane of planes) {
        if (plane.distanceToPoint(vertex) < 0) {
          return false;
        }
      }
    }
    return true;
  }
  buildSampleGeometries(sampleId) {
    const geometries = [];
    const sampleGeom = this._tiles.fetchSample(sampleId, CurrentLod.GEOMETRY);
    MiscHelper.forEach(sampleGeom.geometries, (geometryData) => {
      if (!geometryData.indexBuffer || !geometryData.positionBuffer) {
        return;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setIndex(Array.from(geometryData.indexBuffer));
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(geometryData.positionBuffer, 3)
      );
      geometry.computeBoundsTree();
      geometries.push(geometry);
    });
    return geometries;
  }
  toLocalPlanes(frustum, clipPlanes, toLocal) {
    const local = [];
    this.pushLocalPlanes(frustum.planes, toLocal, local);
    if (clipPlanes) {
      this.pushLocalPlanes(clipPlanes, toLocal, local);
    }
    return local;
  }
  pushLocalPlanes(planes, toLocal, out) {
    for (const plane of planes) {
      if (!Number.isFinite(plane.constant)) {
        continue;
      }
      out.push(new THREE.Plane().copy(plane).applyMatrix4(toLocal));
    }
  }
  geometryIntersectsPlanes(geometry, planes) {
    let hit = false;
    geometry.boundsTree.shapecast({
      intersectsBounds: (box) => CameraUtils.collides(box, planes),
      intersectsTriangle: (tri) => {
        if (this.triangleIntersectsFrustum(tri, planes)) {
          hit = true;
          return true;
        }
        return false;
      }
    });
    return hit;
  }
  // Exact triangle-vs-frustum test by clipping. The frustum is the intersection
  // of its plane half-spaces, so clipping the triangle polygon against every
  // plane (Sutherland-Hodgman) yields exactly triangle ∩ frustum. Non-empty
  // result means they really intersect. This avoids the false positives a
  // "not fully outside any single plane" test gives on large triangles.
  triangleIntersectsFrustum(tri, planes) {
    let poly = [tri.a, tri.b, tri.c];
    for (const plane of planes) {
      poly = this.clipPolygonByPlane(poly, plane);
      if (poly.length === 0) {
        return false;
      }
    }
    return poly.length > 0;
  }
  // Clips a convex polygon to the inside (distance >= 0) half-space of a plane.
  clipPolygonByPlane(poly, plane) {
    const out = [];
    const count = poly.length;
    for (let i = 0; i < count; i++) {
      const current = poly[i];
      const next = poly[(i + 1) % count];
      const dCurrent = plane.distanceToPoint(current);
      const dNext = plane.distanceToPoint(next);
      if (dCurrent >= 0) {
        out.push(current);
      }
      if (dCurrent >= 0 !== dNext >= 0) {
        const t = dCurrent / (dCurrent - dNext);
        out.push(new THREE.Vector3().lerpVectors(current, next, t));
      }
    }
    return out;
  }
  snapCastEdges(data, snaps) {
    const results = [];
    const pointSnap = snaps.includes(SnappingClass.POINT);
    const lineSnap = snaps.includes(SnappingClass.LINE);
    if (pointSnap || lineSnap) {
      this.computeEdgesCast(data, snaps, results);
    }
    this.addDistanceToEdgeResult(results, data.ray);
    return results;
  }
  filterVisible(ids) {
    const result = [];
    for (const id of ids) {
      this._meshes.samples(id, this._temp.sample);
      const itemId = this._temp.sample.item();
      const sampleVisible = this._items.visible(itemId);
      if (sampleVisible) {
        result.push(id);
      }
    }
    return result;
  }
  computeSnaps(snaps, data, id, results) {
    for (const snapClass of snaps) {
      const isValidSnap = this.isValidSnap(snapClass);
      if (isValidSnap) {
        const castData = { snap: snapClass, ...data };
        const founds = this.castSample(id, castData);
        for (const found of founds) {
          results.push(found);
        }
      }
    }
  }
  computeEdgesCast(data, snaps, results) {
    const raw = this.getRawEdges(data);
    const start = performance.now();
    for (const sample of raw) {
      this.fetchSampleData(sample);
      this.computeSnaps(snaps, data, sample, results);
      const tooMuchTime = this.isTimeExceeded(start);
      if (tooMuchTime) {
        break;
      }
    }
  }
  addDistanceToEdgeResult(input, ray) {
    for (const result of input) {
      const point = result.point;
      result.raySquaredDistance = ray.distanceSqToPoint(point);
    }
  }
  getRawEdges(data) {
    const result = this.castBox(data.frustum, data.planes);
    if (result.length <= this._edgeThreshold) {
      return result;
    }
    return this.sortBoxes(data.ray, result, this._edgeThreshold);
  }
  sortBoxes(ray, boxes, limit) {
    const result = [];
    const tempVector = new THREE.Vector3();
    const origin = ray.origin;
    for (let i = 0; i < boxes.length; i++) {
      const boxId = boxes[i];
      const box = this._boxes.get(boxId);
      ray.intersectBox(box, tempVector);
      const distance = tempVector.distanceToSquared(origin);
      result.push(distance);
    }
    const sortedResult = this.dataSort(boxes, result);
    const limitExceeded = limit && sortedResult.length > limit;
    if (limitExceeded) {
      sortedResult.splice(limit);
    }
    return sortedResult;
  }
  castBox(input, planes) {
    const lookup = this._boxes.lookup;
    if (!lookup) {
      return [];
    }
    if (input instanceof THREE.Ray) {
      const result2 = lookup.collideRay(planes, input);
      return this.filterVisible(result2);
    }
    const result = lookup.collideFrustum(planes, input);
    return this.filterVisible(result);
  }
  dataSort(ids, data) {
    const keys = Array.from(ids.keys());
    const sortedKeys = keys.sort((a, b) => data[a] - data[b]);
    const result = [];
    for (const key of sortedKeys) {
      const found = ids[key];
      result.push(found);
    }
    return result;
  }
  localIdsFromItemIds(raycastedItemIds) {
    const localIds = /* @__PURE__ */ new Set();
    for (const id of raycastedItemIds) {
      this._meshes.samples(id, this._temp.sample);
      const itemId = this._temp.sample.item();
      const localIdIndex = this._meshes.meshesItems(itemId);
      if (localIdIndex === null) continue;
      const localId = this._model.localIds(localIdIndex);
      if (localId === null) continue;
      localIds.add(localId);
    }
    return Array.from(localIds);
  }
  getNearest(hits) {
    let nearest = hits[0];
    for (let i = 1; i < hits.length; i++) {
      const current = hits[i];
      if (nearest.raySquaredDistance && current.raySquaredDistance) {
        const nearestScore = this.getNearScore(nearest);
        const currentScore = this.getNearScore(current);
        if (currentScore < nearestScore) {
          nearest = current;
        }
      } else if (current.cameraSquaredDistance < nearest.cameraSquaredDistance) {
        nearest = current;
      }
    }
    return nearest;
  }
  getEdges(data, snaps, results) {
    const founds = this.snapCastEdges(data, snaps);
    if (founds) {
      for (const found of founds) {
        results.push(found);
      }
    }
  }
  getNearScore(input) {
    const factor = this._raycastMultiplier;
    const nearestRay = input.raySquaredDistance * factor;
    const nearScore = nearestRay + input.cameraSquaredDistance;
    return nearScore;
  }
  setupSampleCastData(data) {
    TransformHelper.get(this._temp.sample, this._meshes, this._temp.m1);
    this._temp.m2.copy(this._temp.m1).invert();
    this._temp.ray.copy(data.ray).applyMatrix4(this._temp.m2);
    CameraUtils.transform(data.frustum, this._temp.m2, this._temp.frustum);
  }
  addLocalId(raycast) {
    if (!raycast) {
      return;
    }
    const localIdIndex = this._meshes.meshesItems(raycast.itemId);
    if (localIdIndex === null) {
      return;
    }
    raycast.localId = this._model.localIds(localIdIndex);
  }
  fetchSampleData(sampleId) {
    this._meshes.samples(sampleId, this._temp.sample);
    const reprId = this._temp.sample.representation();
    this._meshes.representations(reprId, this._temp.representation);
  }
  computeRaycastList(ids, data) {
    const uniqueIds = Array.from(new Set(ids));
    const sorted = this.sortBoxes(data.ray, uniqueIds);
    const byRay = this.castBox(data.ray, data.planes);
    const results = this.findAll(sorted, byRay, data);
    if (results.length) {
      if (data.returnAll) {
        for (const result2 of results) {
          this.addLocalId(result2);
        }
        return results;
      }
      const result = this.getNearest(results);
      this.addLocalId(result);
      return result;
    }
    return null;
  }
  formatRaycastResult(results, id, data) {
    for (const result of results) {
      result.point.applyMatrix4(this._temp.m1);
      if (result.normal) {
        result.normal.transformDirection(this._temp.m1);
      }
      if ("facePoints" in result) {
        const sample = this._meshes.samples(id, this._temp.sample);
        TransformHelper.get(sample, this._meshes, this._temp.m3);
        const sourceFacePoints = result.facePoints;
        const transformedFacePoints = new Float64Array(sourceFacePoints.length);
        for (let i = 0; i < sourceFacePoints.length; i += 3) {
          const x = sourceFacePoints[i];
          const y = sourceFacePoints[i + 1];
          const z = sourceFacePoints[i + 2];
          this._temp.v1.set(x, y, z);
          this._temp.v1.applyMatrix4(this._temp.m3);
          transformedFacePoints[i] = this._temp.v1.x;
          transformedFacePoints[i + 1] = this._temp.v1.y;
          transformedFacePoints[i + 2] = this._temp.v1.z;
        }
        result.facePoints = transformedFacePoints;
      }
      result.sampleId = id;
      result.itemId = this._temp.sample.item();
      const distance = data.ray.origin.distanceToSquared(result.point);
      result.cameraSquaredDistance = distance;
      if (!result.snappingClass) {
        result.snappingClass = data.snap;
      }
      if (result.snappedEdgeP1) {
        result.snappedEdgeP1.applyMatrix4(this._temp.m1);
      }
      if (result.snappedEdgeP2) {
        result.snappedEdgeP2.applyMatrix4(this._temp.m1);
      }
    }
  }
  findAll(sortedIds, byRay, data) {
    const allResults = [];
    const start = performance.now();
    for (const sample of sortedIds) {
      this.fetchSampleData(sample);
      if (!byRay.includes(sample)) {
        continue;
      }
      const results = this.castSample(sample, data);
      for (const raycasted of results) {
        allResults.push(raycasted);
      }
      const tooMuchTime = this.isTimeExceeded(start);
      if (tooMuchTime) {
        break;
      }
    }
    return allResults;
  }
  isTimeExceeded(start) {
    const finish = performance.now();
    const duration = finish - start;
    return duration > this._maxDuration;
  }
  getFilteredSampleCast(data) {
    const rawResult = this._tiles.raycast(
      this._temp.representation,
      this._temp.ray,
      this._temp.frustum,
      data.snap
    );
    if (this._temp.planes.length === 0) {
      return rawResult;
    }
    const filteredResult = [];
    if (rawResult) {
      for (const result of rawResult) {
        const planes = this._temp.planes;
        const point = result.point;
        const contained = PlanesUtils.containedInParallelPlanes(planes, point);
        if (contained) {
          filteredResult.push(result);
        }
      }
    }
    return filteredResult;
  }
  getSnaps(first, data, snaps, results) {
    this.fetchSampleData(first.sampleId);
    if (first.normal) {
      this.setCastSide(first, data.ray);
      this.setCastPlane(first);
    }
    this.getFaces(snaps, data, first, results);
    this.getEdges(data, snaps, results);
    for (const found of results) {
      this.addLocalId(found);
    }
  }
  filterOnFront(results) {
    const resultsOnFront = [];
    for (const result of results) {
      const plane = this._temp.tempPlane;
      const distance = plane.distanceToPoint(result.point);
      const isInFront = distance >= 0;
      if (isInFront) {
        resultsOnFront.push(result);
      }
    }
    return resultsOnFront;
  }
  setCastSide(input, ray) {
    const p1 = input.point.clone();
    const vec = p1.sub(ray.origin);
    const sameSide = input.normal.dot(vec) > 0;
    if (sameSide) {
      input.normal.negate();
    }
  }
  getFaces(snaps, data, first, results) {
    for (const snap of snaps) {
      const snapData = { snap, ...data };
      const founds = this.castSample(first.sampleId, snapData);
      for (const found of founds) {
        results.push(found);
      }
    }
  }
  setCastPlane(input) {
    const plane = this._temp.tempPlane;
    const point = input.point.clone();
    const normal = input.normal.clone();
    normal.multiplyScalar(this._precission);
    point.sub(normal);
    plane.setFromNormalAndCoplanarPoint(input.normal, point);
  }
  castSample(id, data) {
    this.setupSampleCastData(data);
    this.setupPlanesForSampleCast(data);
    const results = this.getFilteredSampleCast(data);
    if (results) {
      this.formatRaycastResult(results, id, data);
    }
    return results;
  }
  isValidSnap(snapClass) {
    const isLine = snapClass === SnappingClass.LINE;
    const isPoint = snapClass === SnappingClass.POINT;
    return isLine || isPoint;
  }
  transform(planes, transform) {
    const result = [];
    if (planes) {
      for (const plane of planes) {
        const clone = new THREE.Plane().copy(plane);
        clone.applyMatrix4(transform);
        result.push(clone);
      }
    }
    return result;
  }
  setupPlanesForSampleCast(data) {
    this._temp.planes.length = 0;
    if (data.planes && data.planes.length > 0) {
      const tranformedPlanes = this.transform(data.planes, this._temp.m2);
      for (const plane of tranformedPlanes) {
        this._temp.planes.push(plane);
      }
    }
  }
}
export {
  RaycastController
};
//# sourceMappingURL=raycast-controller.mjs.map
