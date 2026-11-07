function convertRaycastIntersect(hit, object, raycaster) {
  if (hit === null) {
    return null;
  }
  hit.point.applyMatrix4(object.matrixWorld);
  hit.distance = hit.point.distanceTo(raycaster.ray.origin);
  hit.object = object;
  return hit;
}
export {
  convertRaycastIntersect
};
//# sourceMappingURL=GeometryRayIntersectUtilities.mjs.map
