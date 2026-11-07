import * as THREE from "three";
class GridsManager {
  model;
  _grids = new THREE.Group();
  _gridMaterial = new THREE.LineDashedMaterial(
    {
      color: 16777215,
      linewidth: 5,
      depthTest: false,
      dashSize: 1,
      gapSize: 0.3
    }
  );
  _labelMaterial = new THREE.MeshPhongMaterial({
    color: 16777215,
    flatShading: true,
    side: THREE.FrontSide,
    depthTest: false
  });
  _labelConfig;
  _labelMap = /* @__PURE__ */ new Map();
  constructor(model) {
    this.model = model;
  }
  async getGrids({ labels } = {}) {
    let labelsNeedUpdate = false;
    let labelsNeedRepositioning = false;
    if (labels?.show) {
      const incomingConfig = {
        size: 0.2,
        direction: "ltr",
        curveSegments: 12,
        offset: 0.5,
        ...labels.config,
        font: labels.font
      };
      if (!!this._labelConfig && this._labelConfig.offset !== incomingConfig.offset) {
        this._labelConfig.offset = incomingConfig.offset;
        labelsNeedRepositioning = true;
      }
      const isEqual = !!this._labelConfig && this._labelConfig.font === incomingConfig.font && this._labelConfig.size === incomingConfig.size && this._labelConfig.direction === incomingConfig.direction && this._labelConfig.curveSegments === incomingConfig.curveSegments;
      if (!isEqual) {
        labelsNeedUpdate = true;
        this._labelConfig = incomingConfig;
      }
    } else if (this._labelConfig) {
      labelsNeedUpdate = true;
      delete this._labelConfig;
    }
    if (!this._grids.children.length) {
      await this.constructGrids();
      labelsNeedUpdate = true;
    }
    const axisGroups = [];
    if (labelsNeedUpdate) {
      const staleCache = [...this._labelMap];
      this._labelMap.clear();
      const pairs = [];
      this._grids.traverse((object) => {
        if (object.userData.kind === "label") {
          const label = object;
          label.removeFromParent();
        } else if (this._labelConfig && object.userData.kind === "axis") {
          const gridAxisGroup = object;
          const { tag, axis } = gridAxisGroup.userData;
          const labels2 = this.createGridLabels({
            tag,
            axis,
            config: this._labelConfig
          });
          pairs.push([gridAxisGroup, labels2]);
          axisGroups.push(gridAxisGroup);
        }
      });
      for (const [group, labels2] of pairs) {
        group.add(...labels2);
      }
      for (const [, geometry] of staleCache) {
        geometry.dispose();
      }
    } else if (labelsNeedRepositioning) {
      this._grids.traverse((object) => {
        if (object.userData.kind === "axis") {
          const gridAxisGroup = object;
          axisGroups.push(gridAxisGroup);
        }
      });
    }
    for (const group of axisGroups) {
      const [line, label0, label1] = group.children;
      const position = line?.geometry.getAttribute("position").array;
      if (!position) continue;
      const [m0, m1] = this.getGridLabelMatrices(
        position,
        this._labelConfig?.offset ?? 0.5
      );
      if (label0) {
        label0.matrix.copy(m0);
        label0.matrix.decompose(
          label0.position,
          label0.quaternion,
          label0.scale
        );
      }
      if (label1) {
        label1.matrix.copy(m1);
        label1.matrix.decompose(
          label1.position,
          label1.quaternion,
          label1.scale
        );
      }
    }
    return this._grids;
  }
  /**
   * The shared line material used for every grid axis. Mutating its
   * properties (color, opacity, dash sizes, etc.) updates all rendered grid
   * lines without needing to traverse the returned `Object3D`. Replace it
   * with a different material via `setGridMaterial` if you need a different
   * material class.
   */
  getGridMaterial() {
    return this._gridMaterial;
  }
  /**
   * Replace the shared grid material. Walks already-constructed lines and
   * reassigns their `.material`, then disposes the previous material to
   * release GPU resources.
   */
  setGridMaterial(material) {
    const prev = this._gridMaterial;
    this._gridMaterial = material;
    this._grids.traverse((child) => {
      if (child instanceof THREE.Line) {
        child.material = material;
      }
    });
    if (prev !== material) prev.dispose();
  }
  /**
   * The shared material used for every grid axis label. Mutating its
   * properties (color, opacity, dash sizes, etc.) updates all rendered grid
   * labels without needing to traverse the returned `Object3D`. Replace it
   * with a different material via `setGridMaterial` if you need a different
   * material class.
   */
  getLabelMaterial() {
    return this._labelMaterial;
  }
  /**
   * Replace the shared label material. Walks already-constructed labels and
   * reassigns their `.material`, then disposes the previous material to
   * release GPU resources.
   */
  setLabelMaterial(material) {
    const prev = this._labelMaterial;
    this._labelMaterial = material;
    this._grids.traverse((child) => {
      if (child.userData.kind === "label") {
        child.material = material;
      }
    });
    if (prev !== material) prev.dispose();
  }
  async constructGrids() {
    const result = await this.model._invoke("getGrids");
    const tempMatrix = new THREE.Matrix4();
    for (const gridData of result) {
      const grid = new THREE.Group();
      this._grids.add(grid);
      grid.userData.id = gridData.id;
      grid.userData.kind = "grid";
      tempMatrix.fromArray(gridData.transform);
      grid.applyMatrix4(tempMatrix);
      this.getGridAxis(gridData, grid, "uAxes");
      this.getGridAxis(gridData, grid, "vAxes");
      this.getGridAxis(gridData, grid, "wAxes");
      this._grids.add(grid);
    }
  }
  getGridAxis(gridData, grid, axis) {
    for (const { curve, tag } of gridData[axis]) {
      const positions = new Float32Array(curve);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      const axisLine = new THREE.Line(geometry, this._gridMaterial);
      axisLine.computeLineDistances();
      axisLine.userData.tag = tag;
      axisLine.userData.kind = "line";
      axisLine.userData.axis = axis;
      axisLine.renderOrder = 1;
      const axisGroup = new THREE.Group();
      axisGroup.userData.tag = tag;
      axisGroup.userData.kind = "axis";
      axisGroup.userData.axis = axis;
      axisGroup.renderOrder = 1;
      axisGroup.add(axisLine);
      grid.add(axisGroup);
    }
  }
  createGridLabels({
    tag,
    axis,
    config
  }) {
    let geometry = this._labelMap.get(tag);
    if (!geometry) {
      const { font, size, direction, curveSegments } = config;
      const shapes = font.generateShapes(tag, size, direction);
      geometry = new THREE.ShapeGeometry(shapes, curveSegments);
      geometry.computeBoundingBox();
      geometry.center();
      geometry.computeBoundingSphere();
      this._labelMap.set(tag, geometry);
    }
    const mesh0 = new THREE.Mesh(geometry, this._labelMaterial);
    mesh0.userData.kind = "label";
    mesh0.userData.tag = tag;
    mesh0.userData.axis = axis;
    mesh0.userData.index = 0;
    mesh0.renderOrder = 1;
    const mesh1 = new THREE.Mesh(geometry, this._labelMaterial);
    mesh1.userData.kind = "label";
    mesh1.userData.tag = tag;
    mesh1.userData.axis = axis;
    mesh1.userData.index = 1;
    mesh1.renderOrder = 1;
    return [mesh0, mesh1];
  }
  getGridLabelMatrices(position, offsetScalar) {
    const a = new THREE.Vector3().fromArray(position.slice(0, 3));
    const b = new THREE.Vector3().fromArray(position.slice(-3));
    const offset = new THREE.Vector3().subVectors(b, a).normalize().multiplyScalar(offsetScalar);
    const aPos = a.clone().sub(offset);
    const bPos = b.clone().add(offset);
    const z = new THREE.Vector3(0, 0, 1);
    const m0 = new THREE.Matrix4().setPosition(aPos).lookAt(aPos, b, z);
    const m1 = new THREE.Matrix4().setPosition(bPos).lookAt(bPos, a, z);
    return [m0, m1];
  }
  dispose() {
    this._grids.removeFromParent();
    for (const grid of this._grids.children) {
      const line = grid;
      line.geometry.dispose();
      line.geometry = void 0;
      line.material = void 0;
    }
    this._gridMaterial.dispose();
    this._gridMaterial = void 0;
    this._labelMaterial.dispose();
    this._labelMaterial = void 0;
    delete this._labelConfig;
    this._labelMap.forEach((geometry) => geometry.dispose());
    this._labelMap.clear();
  }
}
export {
  GridsManager
};
//# sourceMappingURL=grids-manager.mjs.map
