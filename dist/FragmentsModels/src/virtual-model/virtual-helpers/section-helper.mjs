import * as THREE from "three";
import { CurrentLod } from "../../model/model-types.mjs";
import { SectionGenerator } from "../../utils/geometry/section-generator.mjs";
import { MiscHelper } from "../../utils/misc/misc-helper.mjs";
class SectionHelper {
  _sectionGenerator = new SectionGenerator();
  getSection(model, plane, indices) {
    this._sectionGenerator.plane = plane;
    performance.now();
    const visitedGeometries = /* @__PURE__ */ new Map();
    const meshes = [];
    for (const itemID of indices) {
      const sampleIds = model.boxes.sampleOf(itemID);
      if (!sampleIds) continue;
      for (const sampleId of sampleIds) {
        const boundingBox = model.boxes.get(sampleId);
        if (!plane.intersectsBox(boundingBox)) {
          continue;
        }
        const localIDIndex = model.tiles.meshes.meshesItems(itemID);
        const category = model.data.categories(localIDIndex);
        if (category === "IFCSPACE") {
          continue;
        }
        const sample = model.tiles.meshes.samples(sampleId);
        if (!sample) continue;
        const definitionID = sample.representation();
        if (!visitedGeometries.has(definitionID)) {
          const geometries2 = [];
          const sampleGeom = model.tiles.fetchSample(
            sampleId,
            CurrentLod.GEOMETRY
          );
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
            geometries2.push(geometry);
          });
          visitedGeometries.set(definitionID, geometries2);
        }
        const geometries = visitedGeometries.get(definitionID);
        if (!geometries) continue;
        for (const geometry of geometries) {
          const mesh = new THREE.Mesh(geometry);
          const transform = model.tiles.getSampleTransform(sampleId);
          mesh.applyMatrix4(transform);
          mesh.updateWorldMatrix(true, true);
          meshes.push(mesh);
        }
      }
    }
    const buffer = new Float32Array(6e5);
    const posAttr = new THREE.BufferAttribute(buffer, 3, false);
    const { index, indexes } = this._sectionGenerator.createEdges({
      meshes,
      posAttr
    });
    const fillsIndices = this._sectionGenerator.createFills(buffer, indexes);
    for (const [, geometries] of visitedGeometries) {
      for (const geometry of geometries) {
        geometry.dispose();
      }
    }
    const result = {
      buffer,
      index,
      fillsIndices
    };
    return result;
  }
}
export {
  SectionHelper
};
//# sourceMappingURL=section-helper.mjs.map
