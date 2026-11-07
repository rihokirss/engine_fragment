import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { AlignmentCurveType } from "./model-types.mjs";
class AlignmentsManager {
  model;
  _endpointsMaterials = {
    interior: new THREE.PointsMaterial({
      color: 15658734,
      size: 8,
      sizeAttenuation: false,
      depthTest: false
    }),
    exterior: new THREE.PointsMaterial({
      color: 16777215,
      size: 16,
      sizeAttenuation: false,
      depthTest: false
    })
  };
  // Each alignment is a THREE.Group of THREE.Line2 (curves) and THREE.Points (endpoints)
  _absoluteAlignments = new THREE.Group();
  _horizontalAlignments = new THREE.Group();
  _verticalAlignments = new THREE.Group();
  // LAZY, and it matters beyond tidiness: `LineMaterial` is a WebGL-only
  // addon (it builds on ShaderLib / UniformsUtils, which three.webgpu does not
  // export), and these used to be constructed for EVERY model at construction,
  // so with `three` resolved to three/webgpu no model could load at all, even
  // with no alignment in it. Built on first use instead; on WebGL the same
  // materials are created, only later.
  _alignmentMaterialsLazy = null;
  get _alignmentMaterials() {
    if (!this._alignmentMaterialsLazy) {
      this._alignmentMaterialsLazy = /* @__PURE__ */ new Map([
        [
          AlignmentCurveType.NONE,
          new LineMaterial({
            color: 16777215,
            linewidth: 5,
            depthTest: false
          })
        ],
        [
          AlignmentCurveType.LINES,
          new LineMaterial({
            color: 16711935,
            linewidth: 5,
            depthTest: false
          })
        ],
        [
          AlignmentCurveType.CLOTHOID,
          new LineMaterial({
            color: 16711680,
            linewidth: 5,
            depthTest: false
          })
        ],
        [
          AlignmentCurveType.ELLIPSE_ARC,
          new LineMaterial({
            color: 65535,
            linewidth: 5,
            depthTest: false
          })
        ],
        [
          AlignmentCurveType.PARABOLA,
          new LineMaterial({
            color: 255,
            linewidth: 5,
            depthTest: false
          })
        ]
      ]);
    }
    return this._alignmentMaterialsLazy;
  }
  constructor(model) {
    this.model = model;
  }
  async getAlignments() {
    if (!this._absoluteAlignments.children.length) {
      await this.constructAlignments();
    }
    return this._absoluteAlignments;
  }
  async getHorizontalAlignments() {
    if (!this._horizontalAlignments.children.length) {
      await this.constructAlignments();
    }
    return this._horizontalAlignments;
  }
  async getVerticalAlignments() {
    if (!this._verticalAlignments.children.length) {
      await this.constructAlignments();
    }
    return this._verticalAlignments;
  }
  async getAlignmentStyles() {
    return { ...this._alignmentMaterials, ...this._endpointsMaterials };
  }
  async constructAlignments() {
    const result = await this.model._invoke(
      "getAlignments"
    );
    for (const alignmentData of result) {
      this.constructLine(alignmentData.absolute, this._absoluteAlignments);
      this.constructLine(alignmentData.horizontal, this._horizontalAlignments);
      this.constructLine(alignmentData.vertical, this._verticalAlignments);
    }
  }
  constructLine(data, parent) {
    if (!data.length) {
      return;
    }
    const iPoints = [];
    const ePoints = [];
    const alignment = new THREE.Group();
    parent.add(alignment);
    const firstPoints = data[0].points;
    const lastPoints = data[data.length - 1].points;
    ePoints.push(lastPoints[0], lastPoints[1], lastPoints[2]);
    ePoints.push(
      firstPoints[firstPoints.length - 3],
      firstPoints[firstPoints.length - 2],
      firstPoints[firstPoints.length - 1]
    );
    for (const curve of data) {
      const points = curve.points;
      iPoints.push(points[0], points[1], points[2]);
      iPoints.push(
        points[points.length - 3],
        points[points.length - 2],
        points[points.length - 1]
      );
      const geometry = new LineGeometry();
      geometry.setPositions(points);
      const material = this._alignmentMaterials.get(curve.type);
      const line = new Line2(geometry, material);
      alignment.add(line);
      line.renderOrder = 1;
      line.userData.points = points;
    }
    const { interior, exterior } = this._endpointsMaterials;
    this.constructPoints(iPoints, interior, alignment);
    this.constructPoints(ePoints, exterior, alignment);
  }
  constructPoints(pointsArray, material, alignment) {
    const points = new THREE.Points();
    const pointsGeom = new THREE.BufferGeometry();
    const pointsBuffer = new Float32Array(pointsArray);
    const pointsAttr = new THREE.BufferAttribute(pointsBuffer, 3);
    pointsGeom.setAttribute("position", pointsAttr);
    points.geometry = pointsGeom;
    points.material = material;
    alignment.add(points);
    points.renderOrder = 2;
  }
  dispose() {
    const groups = [
      this._absoluteAlignments,
      this._horizontalAlignments,
      this._verticalAlignments
    ];
    for (const group of groups) {
      group.traverse((child) => {
        const object = child;
        if (!object.geometry) return;
        object.geometry.dispose();
        object.geometry = void 0;
        object.material = void 0;
      });
      group.clear();
      group.removeFromParent();
    }
    if (this._alignmentMaterialsLazy) {
      for (const material of this._alignmentMaterialsLazy.values()) {
        material.dispose();
      }
      this._alignmentMaterialsLazy.clear();
      this._alignmentMaterialsLazy = null;
    }
    for (const material of Object.values(this._endpointsMaterials)) {
      material.dispose();
    }
  }
}
export {
  AlignmentsManager
};
//# sourceMappingURL=alignments-manager.mjs.map
