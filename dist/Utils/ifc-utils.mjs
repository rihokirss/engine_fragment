import * as THREE from "three";
import * as WEBIFC from "web-ifc";
class FragmentsIfcUtils {
  /**
   * The absolute placement of `item`, in three.js coordinates.
   * @param unitsFactor - Pass a precomputed {@link getUnitsFactor} to avoid
   * recalculating it.
   * @param modelId - The web-ifc model `item` belongs to.
   */
  static getAbsolutePlacement(webIfc, item, unitsFactor, modelId = 0) {
    const factor = unitsFactor ?? this.getUnitsFactor(webIfc, modelId);
    const ifcResult = new THREE.Matrix4();
    ifcResult.identity();
    const placementId = item.ObjectPlacement?.value;
    if (placementId !== null && placementId !== void 0) {
      const placement = webIfc.GetLine(modelId, placementId);
      this.getAbsolutePlacementRecursively(
        webIfc,
        modelId,
        placement,
        ifcResult,
        factor
      );
    }
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.makeRotationX(-Math.PI / 2);
    ifcResult.premultiply(tempMatrix);
    return ifcResult;
  }
  /**
   * The factor that converts the model's length unit to metres.
   * @param modelId - The web-ifc model to read the units of.
   */
  static getUnitsFactor(ifcApi, modelId = 0) {
    const unitAssignmentIds = ifcApi.GetLineIDsWithType(
      modelId,
      WEBIFC.IFCUNITASSIGNMENT
    );
    let result = 1;
    if (unitAssignmentIds.size() === 0) return result;
    for (let i = 0; i < unitAssignmentIds.size(); i++) {
      const assignmentId = unitAssignmentIds.get(i);
      const assignmentAttrs = ifcApi.GetLine(modelId, assignmentId);
      for (const unitHandle of assignmentAttrs.Units) {
        const unit = ifcApi.GetLine(modelId, unitHandle.value);
        const value = unit.UnitType?.value;
        if (value !== "LENGTHUNIT") continue;
        let factor = 1;
        let unitValue = 1;
        if (unit.Name.value === "METRE") unitValue = 1;
        if (unit.Name.value === "FOOT") unitValue = 0.3048;
        if (unit.Prefix?.value === "MILLI") {
          factor = 1e-3;
        } else if (unit.Prefix?.value === "CENTI") {
          factor = 0.01;
        } else if (unit.Prefix?.value === "DECI") {
          factor = 0.1;
        }
        result = unitValue * factor;
      }
    }
    return result;
  }
  static getAbsolutePlacementRecursively(webIfc, modelId, placement, result, unitsFactor) {
    const relativePlacementId = placement.RelativePlacement.value;
    const relativePlacement = webIfc.GetLine(modelId, relativePlacementId);
    const locationId = relativePlacement.Location.value;
    const zAxisRef = relativePlacement.Axis;
    const xAxisRef = relativePlacement.RefDirection;
    const pos = new THREE.Vector3(0, 0, 0);
    const zAxis = new THREE.Vector3(0, 0, 1);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const locationData = webIfc.GetLine(modelId, locationId);
    if (locationData) {
      const [x, y, z] = locationData.Coordinates;
      pos.x = x.value * unitsFactor;
      pos.y = y.value * unitsFactor;
      pos.z = z.value * unitsFactor;
    }
    if (zAxisRef) {
      const zAxisData = webIfc.GetLine(modelId, zAxisRef.value);
      const [z1, z2, z3] = zAxisData.DirectionRatios.map((v) => typeof v === "number" ? v : v.value);
      zAxis.x = z1;
      zAxis.y = z2;
      zAxis.z = z3;
    }
    if (xAxisRef) {
      const xAxisData = webIfc.GetLine(modelId, xAxisRef.value);
      const [x1, x2, x3] = xAxisData.DirectionRatios.map((v) => typeof v === "number" ? v : v.value);
      xAxis.x = x1;
      xAxis.y = x2;
      xAxis.z = x3;
    }
    const yAxis = zAxis.clone().cross(xAxis);
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.fromArray([
      xAxis.x,
      xAxis.y,
      xAxis.z,
      0,
      yAxis.x,
      yAxis.y,
      yAxis.z,
      0,
      zAxis.x,
      zAxis.y,
      zAxis.z,
      0,
      pos.x,
      pos.y,
      pos.z,
      1
    ]);
    result.premultiply(tempMatrix);
    if (!placement.PlacementRelTo || !placement.PlacementRelTo.value) return;
    const parentPlacementId = placement.PlacementRelTo.value;
    const parentPlacement = webIfc.GetLine(modelId, parentPlacementId);
    this.getAbsolutePlacementRecursively(
      webIfc,
      modelId,
      parentPlacement,
      result,
      unitsFactor
    );
  }
}
export {
  FragmentsIfcUtils
};
//# sourceMappingURL=ifc-utils.mjs.map
