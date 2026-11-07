import * as THREE from "three";
import * as WEBIFC from "web-ifc";
import { FragmentsIfcUtils } from "../../../../Utils/ifc-utils.mjs";
class GridReader {
  _webIfc;
  _modelId;
  constructor(webIfc, modelId) {
    this._webIfc = webIfc;
    this._modelId = modelId;
  }
  /**
   * Reads every IFCGRID of the model. A grid or an axis that cannot be read is
   * left out and returned in `errors`, for the caller to report its own way;
   * it never fails the read.
   */
  read() {
    const errors = [];
    try {
      const result = [];
      const coordMatrixValues = this._webIfc.GetCoordinationMatrix(
        this._modelId
      );
      const coordMatrix = new THREE.Matrix4();
      coordMatrix.fromArray(coordMatrixValues);
      const units = FragmentsIfcUtils.getUnitsFactor(
        this._webIfc,
        this._modelId
      );
      const gridsVector = this._webIfc.GetLineIDsWithType(
        this._modelId,
        WEBIFC.IFCGRID
      );
      const size = gridsVector.size();
      for (let i = 0; i < size; i++) {
        const id = gridsVector.get(i);
        try {
          const grid = this._webIfc.GetLine(
            this._modelId,
            id
          );
          if (!grid.ObjectPlacement) {
            errors.push({ kind: "noPlacement", gridId: id });
          }
          const transform = FragmentsIfcUtils.getAbsolutePlacement(
            this._webIfc,
            grid,
            units,
            this._modelId
          );
          transform.premultiply(coordMatrix);
          const uAxes = this.getGridAxes(grid, units, "UAxes");
          const vAxes = this.getGridAxes(grid, units, "VAxes");
          const wAxes = this.getGridAxes(grid, units, "WAxes");
          const data = {
            id,
            // This runs inside the per-grid catch, so an unguarded read would
            // drop the whole grid. An unset GlobalId reads back as null, which
            // `guid?: string` does not admit, so normalise it to undefined and
            // let it drop out of the serialized data.
            guid: grid.GlobalId?.value ?? void 0,
            // Optional in the schema; normalised to undefined like the guid.
            name: grid.Name?.value ?? void 0,
            transform: transform.elements,
            uAxes: uAxes.value,
            vAxes: vAxes.value,
            wAxes: wAxes.value
          };
          const unsupportedAxes = [
            ...uAxes.errors,
            ...vAxes.errors,
            ...wAxes.errors
          ];
          if (unsupportedAxes.length > 0) {
            data.unsupportedAxes = unsupportedAxes;
            errors.push({
              kind: "unsupportedAxes",
              gridId: id,
              axes: unsupportedAxes
            });
          }
          result.push(data);
        } catch (error) {
          errors.push({ kind: "unreadableGrid", gridId: id, cause: error });
        }
      }
      return { value: result, errors };
    } catch (error) {
      errors.push({ kind: "unreadableModel", cause: error });
      return { value: [], errors };
    }
  }
  /**
   * The axes of `ifcGrid` under `ifcKey`, and in `errors` those whose curve it
   * cannot represent.
   */
  getGridAxes(ifcGrid, units, ifcKey) {
    const axisDataArr = [];
    const errors = [];
    for (const axis of ifcGrid[ifcKey] ?? []) {
      const { value: axisId } = axis;
      const axisCurve = this._webIfc.GetLine(this._modelId, axisId);
      const curveId = axisCurve.AxisCurve.value;
      const curve = this._webIfc.GetLine(this._modelId, curveId);
      const axisData = {
        // AxisTag is an optional IfcLabel. web-ifc returns it as null when the
        // IFC omits it (IFCGRIDAXIS($,...)), so read it defensively; otherwise
        // a single tagless axis threw and the outer catch dropped every grid.
        tag: axisCurve.AxisTag?.value ?? "",
        curve: []
      };
      const pushPoint = (coords) => {
        const x = (coords[0]?.value ?? 0) * units;
        const y = (coords[1]?.value ?? 0) * units;
        const z = (coords[2]?.value ?? 0) * units;
        axisData.curve.push(x, y, z);
      };
      if (curve.type === WEBIFC.IFCPOLYLINE && curve.Points) {
        for (const { value: pointId } of curve.Points) {
          const ifcPoints = this._webIfc.GetLine(this._modelId, pointId);
          if (ifcPoints.Coordinates) {
            pushPoint(ifcPoints.Coordinates);
          }
        }
      } else if (curve.Points?.value) {
        const ifcPoints = this._webIfc.GetLine(
          this._modelId,
          curve.Points.value
        );
        if (ifcPoints.CoordList) {
          const order = this.getPointOrder(curve, ifcPoints.CoordList.length);
          if (!order) {
            errors.push({
              tag: axisData.tag,
              curveType: `${this.getCurveTypeName(curve)} with IFCARCINDEX segments`
            });
            continue;
          }
          for (const index of order) {
            pushPoint(ifcPoints.CoordList[index]);
          }
        }
      }
      if (axisData.curve.length === 0) {
        errors.push({
          tag: axisData.tag,
          curveType: this.getCurveTypeName(curve)
        });
        continue;
      }
      axisDataArr.push(axisData);
    }
    return { value: axisDataArr, errors };
  }
  /**
   * The 0-based indices an indexed polycurve runs through its point list in:
   * its `Segments` when it has them, which may revisit, skip or reverse
   * points, and every point in turn when it has none. `null` when a segment
   * is an arc, which would need tessellating.
   */
  getPointOrder(curve, pointCount) {
    const segments = curve.type === WEBIFC.IFCINDEXEDPOLYCURVE ? this._webIfc.GetRawLineData(this._modelId, curve.expressID).arguments[1] : null;
    if (!segments) {
      return Array.from({ length: pointCount }, (_, index) => index);
    }
    const order = [];
    for (const { typecode, value } of segments) {
      if (typecode !== WEBIFC.IFCLINEINDEX) return null;
      for (const { value: index } of value) {
        if (order[order.length - 1] !== index - 1) order.push(index - 1);
      }
    }
    return order;
  }
  getCurveTypeName(curve) {
    try {
      const name = this._webIfc.GetNameFromTypeCode(curve.type);
      if (name) return name.toUpperCase();
    } catch {
    }
    return `IFC type ${curve.type}`;
  }
}
export {
  GridReader
};
//# sourceMappingURL=grid-reader.mjs.map
