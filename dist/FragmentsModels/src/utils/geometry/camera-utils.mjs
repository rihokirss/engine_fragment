import * as THREE from "three";
import { PlanesUtils } from "./planes-utils.mjs";
class CameraUtils {
  static tempSize = new THREE.Vector3();
  /** Axis-aligned inward normals, in THREE's plane order. */
  static axisNormals = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ];
  /**
   * A frustum containing all of `box`, used when no camera has been set.
   *
   * This is deliberately *not* signalled out of band. The worker ships as
   * a separate artifact that consumers pin or self-host, so a main thread
   * can be paired with a worker that predates any new flag. A frustum that
   * contains the model needs no agreement: it is structurally an ordinary
   * frustum, so every worker — old or new — culls against it and keeps
   * every box, which is exactly the intended behaviour. Contrast the
   * default `new THREE.Frustum()`, whose six identical (1,0,0)/0 planes
   * discard the entire negative-X half space (#255).
   *
   * The extent comes from the model's own bounds rather than a fixed
   * constant, so it carries no assumption about authoring units. That
   * matters because fragments does not normalise geometry to metres — the
   * IFC length-unit factor is applied to storey-height properties only —
   * so a millimetre-scale, geo-referenced model can legitimately reach
   * coordinates of 1e10, which any hard-coded extent would start clipping.
   *
   * `box` must be in model space, because that is where the worker culls:
   * `VirtualBoxController.get()` returns raw flatbuffer coordinates with
   * only the per-sample transform applied, and the `modelPlacement` on the
   * view is never read by anything. Callers holding a world-space box —
   * `FragmentsModel.box` is world space — must first push it through the
   * inverse placement, mirroring what {@link transform} does for the
   * real-camera frustum. Under an identity placement the two spaces
   * coincide, so this is easy to get wrong without noticing.
   */
  static containing(box, result = new THREE.Frustum()) {
    const min = box.isEmpty() ? { x: -1, y: -1, z: -1 } : box.min;
    const max = box.isEmpty() ? { x: 1, y: 1, z: 1 } : box.max;
    const size = box.isEmpty() ? this.tempSize.set(2, 2, 2) : box.getSize(this.tempSize);
    const margin = Math.max(size.x, size.y, size.z) || 1;
    const constants = [
      -min.x + margin,
      max.x + margin,
      -min.y + margin,
      max.y + margin,
      -min.z + margin,
      max.z + margin
    ];
    for (let i = 0; i < result.planes.length; i++) {
      const [x, y, z] = this.axisNormals[i];
      result.planes[i].normal.set(x, y, z);
      result.planes[i].constant = constants[i];
    }
    return result;
  }
  static transform(input, transform, result = new THREE.Frustum()) {
    for (let i = 0; i < result.planes.length; i++) {
      const resultPlane = result.planes[i];
      const inputPlane = input.planes[i];
      resultPlane.copy(inputPlane);
      resultPlane.applyMatrix4(transform);
    }
    return result;
  }
  static isIncluded(box, ps) {
    return PlanesUtils.collides(box, ps, true);
  }
  static collides(box, ps) {
    return PlanesUtils.collides(box, ps, false);
  }
}
export {
  CameraUtils
};
//# sourceMappingURL=camera-utils.mjs.map
