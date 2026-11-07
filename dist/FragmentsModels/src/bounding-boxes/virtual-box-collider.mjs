import { CameraUtils } from "../utils/geometry/camera-utils.mjs";
class VirtualBoxCollider {
  _data;
  _compressor;
  constructor(compressor, data) {
    this._data = data;
    this._compressor = compressor;
  }
  frustumCollide(bounds, frustum, fullyIncluded = false) {
    const planes = this.getFrustumPlanes(frustum, bounds);
    const onCollide = this.getFrustumOnCollide(planes);
    const onIncludes = this.getFrustumOnIncludes(planes);
    const onSeen = this.newDefaultCallback(true);
    return this.collide(onCollide, onIncludes, onSeen, fullyIncluded);
  }
  /**
   * Marks every point whose box does NOT touch the given frustum (plus
   * optional clipping planes) with 1 in `mask`, and every candidate
   * with 0. Same traversal and plane semantics as {@link frustumCollide},
   * but writes into a caller-owned mask instead of allocating a result
   * array — the culling hot path calls this on every view change, and
   * with everything on screen a result array would hold every sample.
   */
  frustumFillOutsideMask(bounds, frustum, mask) {
    mask.fill(1);
    const planes = this.getFrustumPlanes(frustum, bounds);
    const onCollide = this.getFrustumOnCollide(planes);
    const onIncludes = this.getFrustumOnIncludes(planes);
    const onSeen = this.newDefaultCallback(true);
    this.traverse(onCollide, onIncludes, onSeen, (data) => {
      mask[data] = 0;
    });
  }
  rayCollide(bounds, ray) {
    const onCollide = this.getRayOnCollide(ray);
    const onIncludes = this.newDefaultCallback(false);
    const onSeen = this.getRayOnSeen(bounds);
    return this.collide(onCollide, onIncludes, onSeen);
  }
  getPointData(position) {
    const point = this.getPoint(position);
    return point.data;
  }
  getBounds(position) {
    const point = this.getPoint(position);
    return this._compressor.inflate(point.box);
  }
  isPoint(position) {
    const point = this.getPoint(position);
    return point.isPoint;
  }
  newDefaultCallback(value) {
    return (_args) => value;
  }
  groupSize(position) {
    const point = this.getPoint(position);
    return point.size;
  }
  getPoint(position) {
    return this._data.points[position];
  }
  getRayOnSeen(bounds) {
    let onSeen = this.newDefaultCallback(true);
    const boundsExists = bounds?.length > 0;
    if (boundsExists) {
      onSeen = (box) => {
        return CameraUtils.collides(box, bounds);
      };
    }
    return onSeen;
  }
  getRayOnCollide(beam) {
    return (box) => {
      return beam.intersectsBox(box);
    };
  }
  collide(onCollide, onIncludes, onSeen, fullyIncluded = false) {
    const result = [];
    this.traverse(onCollide, onIncludes, onSeen, (data, includes) => {
      if (!fullyIncluded || includes) {
        result.push(data);
      }
    });
    return result;
  }
  // Shared hierarchy walk: groups whose box misses the query are skipped
  // wholesale, fully-included groups collect their leaves without further
  // box tests, and each surviving leaf is handed to `onLeaf` together
  // with whether it sits in a fully-included group.
  traverse(onCollide, onIncludes, onSeen, onLeaf) {
    const pointAmount = this._data.points.length;
    let currentPosition = 0;
    const addAllPoints = (bound, includes) => {
      const finalPosition = currentPosition + this.groupSize(currentPosition);
      for (; currentPosition < finalPosition; currentPosition++) {
        const isPoint = this.isPoint(currentPosition);
        if (isPoint && onSeen(bound)) {
          onLeaf(this.getPointData(currentPosition), includes);
        }
      }
    };
    const processCollisions = () => {
      const bound = this.getBounds(currentPosition);
      const includes = onIncludes(bound);
      const isPoint = this.isPoint(currentPosition);
      const collides = includes || onCollide(bound);
      if (isPoint && collides && onSeen(bound)) {
        onLeaf(this.getPointData(currentPosition), includes);
      }
      if (collides || isPoint) {
        currentPosition++;
        if (includes && !isPoint) {
          addAllPoints(bound, includes);
        }
      } else {
        currentPosition += this.groupSize(currentPosition);
      }
    };
    while (currentPosition < pointAmount) {
      processCollisions();
    }
  }
  getFrustumOnIncludes(planes) {
    return (box) => {
      return CameraUtils.isIncluded(box, planes);
    };
  }
  getFrustumOnCollide(planes) {
    return (box) => {
      return CameraUtils.collides(box, planes);
    };
  }
  getFrustumPlanes(frustum, bounds) {
    const planes = [];
    for (const plane of frustum.planes) {
      planes.push(plane);
    }
    if (bounds) {
      for (const plane of bounds) {
        planes.push(plane);
      }
    }
    return planes;
  }
}
export {
  VirtualBoxCollider
};
//# sourceMappingURL=virtual-box-collider.mjs.map
