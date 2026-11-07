class RaycastHelper {
  raycast(model, ray, frustum, returnAll) {
    if (model.view) {
      return model.raycaster.raycast(
        ray,
        frustum,
        model.view.clippingPlanes,
        returnAll
      );
    }
    return void 0;
  }
  snapRaycast(model, ray, frustum, snappingClass) {
    if (model.view) {
      return model.raycaster.snapRaycast(
        ray,
        frustum,
        snappingClass,
        model.view.clippingPlanes
      );
    }
    return [];
  }
  rectangleRaycast(model, frustum, fullyIncluded) {
    if (model.view) {
      return model.raycaster.rectangleRaycast(
        frustum,
        model.view.clippingPlanes,
        fullyIncluded
      );
    }
    return [];
  }
}
export {
  RaycastHelper
};
//# sourceMappingURL=raycast-helper.mjs.map
