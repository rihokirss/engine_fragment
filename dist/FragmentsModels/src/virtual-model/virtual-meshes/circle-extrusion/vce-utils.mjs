import * as THREE from "three";
import { VceCasterUtils } from "./vce-caster-utils.mjs";
import { limitOf2Bytes } from "../../../model/model-types.mjs";
import { Axis } from "../../../../../Schema/axis.mjs";
import { WireSet } from "../../../../../Schema/wire-set.mjs";
import { CircleCurve } from "../../../../../Schema/circle-curve.mjs";
import { CircleExtrusion } from "../../../../../Schema/circle-extrusion.mjs";
import { AxisPartClass } from "../../../../../Schema/axis-part-class.mjs";
class VceUtils {
  static up = new THREE.Vector3(0, 0, 1);
  static circleCurves = [];
  static circleCurvePoints;
  static temp = {
    circleExtrusion: new CircleExtrusion(),
    circleCurve: new CircleCurve(),
    wireSet: new WireSet(),
    axis: new Axis(),
    rotation: new THREE.Quaternion(),
    vector: new THREE.Vector3()
  };
  static _wireSize = 6;
  static _minSize = 6;
  static _maxSize = 30;
  static _axisPartSize = {
    verticesLength: 0,
    indicesLength: 0
  };
  static newPaths(circleCurve, size) {
    const data = VceUtils.newPathData();
    this.fetchCircleCurveData(circleCurve, data);
    this.fetchCircleCurveMids(size, data, circleCurve);
    this.fetchCircleCurveEnds(data, circleCurve);
    this.fetchCircleCurveCuts(data);
    return data.cuts;
  }
  static getAxisPartSize(axis, id, vertexSize) {
    const part = axis.parts(id);
    const order = axis.order(id);
    const data = VceUtils.getAxisPartData(part, vertexSize, axis, order);
    VceUtils.fetchAxisPartSize(vertexSize, data);
    return this._axisPartSize;
  }
  static vertexLength(radius, factor = 200) {
    const count = Math.round(radius * factor);
    const clamped = Math.max(count, VceUtils._minSize);
    return Math.min(clamped, VceUtils._maxSize);
  }
  static setPathVertices(vertexSize) {
    const points = this.circleCurvePoints;
    const noPoints = !points;
    const pointsChanged = points && points.length !== vertexSize;
    if (noPoints || pointsChanged) {
      this.circleCurvePoints = [];
      for (let i = 0; i < vertexSize; i++) {
        const halfCircle = 2 * Math.PI;
        const value = halfCircle * i;
        const angle = value / vertexSize;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const result = new THREE.Vector3(sin, cos, 0);
        this.circleCurvePoints.push(result);
      }
    }
  }
  static fetchCircleCurveEnds(data, circleCurve) {
    data.last.copy(data.first);
    data.last.applyAxisAngle(data.axis, circleCurve.aperture());
    data.last.multiplyScalar(circleCurve.radius());
    data.last.add(data.center);
    data.first.multiplyScalar(circleCurve.radius());
    data.first.add(data.center);
  }
  static getAxisPartData(part, vertexSize, axis, order) {
    const data = {
      [AxisPartClass.WIRE]: this.getAxisPartWireData,
      [AxisPartClass.WIRE_SET]: this.getAxisPartWireSetData,
      [AxisPartClass.CIRCLE_CURVE]: this.getAxisPartCircleCurveData
    };
    return data[part](axis, order, vertexSize);
  }
  static newEmptyAxisPartData() {
    return {
      indices: 0,
      points: 0,
      faces: 0,
      links: 0
    };
  }
  static getAxisPartWireSetData = (axis, order, size) => {
    const defValue = 2;
    const data = this.newEmptyAxisPartData();
    axis.wireSets(order, this.temp.wireSet);
    const wires = this.temp.wireSet.psLength() - 1;
    data.points = wires * defValue * size;
    data.indices = this._wireSize * wires * size;
    data.faces = wires * defValue;
    return data;
  };
  static fetchCircleCurveMids(size, data, circleCurve) {
    const count = size - 2;
    for (let i = 0; i < count; i++) {
      const newMid = new THREE.Vector3();
      newMid.copy(data.first);
      const aperture = circleCurve.aperture();
      const fraction = size - 1;
      const totalAngle = aperture * (i + 1);
      const angle = totalAngle / fraction;
      newMid.applyAxisAngle(data.axis, angle);
      newMid.multiplyScalar(circleCurve.radius());
      newMid.add(data.center);
      data.mids[i] = newMid;
    }
  }
  static getAxisPartWireData = (_axis, _order, size) => {
    const data = this.newEmptyAxisPartData();
    data.points = 2 * size;
    data.indices = this._wireSize * size;
    data.faces = 2;
    return data;
  };
  static validSize(pointsSize, extraPoints, vertexSize) {
    const totalSize = pointsSize + extraPoints + vertexSize;
    return limitOf2Bytes >= totalSize;
  }
  static fetchCircleCurveCuts(data) {
    data.cuts.push(data.first);
    data.cuts.push(...data.mids);
    data.cuts.push(data.last);
  }
  static fetchCircleCurveData(circleCurve, data) {
    const pos = circleCurve.position();
    data.center.set(pos.x(), pos.y(), pos.z());
    const xDir = circleCurve.xDirection();
    data.axis.set(xDir.x(), xDir.y(), xDir.z());
    const yDir = circleCurve.yDirection();
    data.first.set(yDir.x(), yDir.y(), yDir.z());
  }
  static newPathData() {
    return {
      axis: new THREE.Vector3(),
      cuts: [],
      center: new THREE.Vector3(),
      last: new THREE.Vector3(),
      first: new THREE.Vector3(),
      mids: []
    };
  }
  static fetchAxisPartSize(vertexSize, data) {
    const indexFactor = vertexSize - 2;
    const coordsCount = 3;
    const indices = data.faces * indexFactor * coordsCount;
    const links = data.links * vertexSize * this._wireSize;
    this._axisPartSize.verticesLength = data.points;
    this._axisPartSize.indicesLength = data.indices + indices + links;
  }
  static getAxisPartCircleCurveData = (axis, order, size) => {
    const data = this.newEmptyAxisPartData();
    axis.circleCurves(order, this.temp.circleCurve);
    const bends = VceCasterUtils.circleCurve3Divisions(this.temp.circleCurve);
    const pointCount = size * bends;
    data.points = pointCount;
    const indexFactor = size * (bends - 1);
    const indexCount = this._wireSize * indexFactor;
    data.indices = indexCount;
    const defValue = 2;
    data.faces = defValue;
    data.links = defValue;
    return data;
  };
}
export {
  VceUtils
};
//# sourceMappingURL=vce-utils.mjs.map
