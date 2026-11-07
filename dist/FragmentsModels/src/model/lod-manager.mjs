import * as THREE from "three";
import { LodHelper } from "../lod/lod-helper.mjs";
import { CurrentLod } from "./model-types.mjs";
import { LODGeometry } from "../lod/lod-geometry.mjs";
import { LODMesh } from "../lod/lod-mesh.mjs";
class LODManager {
  _materials;
  // TODO: Deduplicate with other white values
  white = 4294967295;
  constructor(materials) {
    this._materials = materials;
  }
  createMesh(geometry, request) {
    const material = this._materials.getFromRequest(request);
    if (!("isLodMaterial" in material && material.isLodMaterial)) {
      throw new Error("Fragments: material is not an instance of LodMaterial.");
    }
    const { positions } = request;
    if (!positions) {
      throw new Error(
        "Fragments: no positions provided to create the LOD mesh."
      );
    }
    const lodGeometry = new LODGeometry();
    const deleteEvent = this.deleteAttributeEvent(geometry);
    LodHelper.setLodBuffer(lodGeometry, positions, deleteEvent);
    const mesh = new LODMesh(lodGeometry, [material]);
    return mesh;
  }
  updateVisibility(mesh, status) {
    const { geometry } = mesh;
    const { visibilityData, highlightData } = status;
    LodHelper.setLodVisibility(geometry, visibilityData);
    if (highlightData) {
      LodHelper.setLodHighlight(geometry, highlightData);
    }
    geometry.addGroup(0, Infinity, 0);
  }
  applyHighlight(mesh, request) {
    const {
      tileData: { highlightIds, highlightData },
      modelId,
      material: index
    } = request;
    if (!highlightData || !highlightIds) return;
    const material = mesh.material[0];
    const colors = [];
    let opacity = material.highlightOpacity;
    let transparent = material.transparent;
    let opacitySet = false;
    for (let i = 0; i < highlightIds.length; ++i) {
      const definition = this._materials.getHighlightProps(
        highlightIds[i],
        index,
        modelId
      );
      if (!definition) {
        colors.push(void 0);
        continue;
      }
      colors.push(
        definition.color ? new THREE.Color(definition.color) : void 0
      );
      if (!opacitySet) {
        opacity = definition.opacity;
        opacitySet = true;
      }
      transparent = definition.opacity < 1 || transparent;
    }
    LodHelper.setLodHighlightColors(mesh.geometry, highlightData, colors);
    material.highlightOpacity = opacity;
    material.transparent = transparent;
  }
  processMesh(mesh, request) {
    const { geometry } = mesh;
    const {
      tileData: { visibilityData },
      currentLod
    } = request;
    if (currentLod === CurrentLod.WIRES && mesh instanceof LODMesh) {
      this.updateVisibility(mesh, request.tileData);
    } else if (visibilityData && visibilityData.position.length > 0) {
      for (let i = 0; i < visibilityData.position.length; ++i) {
        const isWhite = visibilityData.size[i] === this.white;
        const position = visibilityData.position[i];
        const value = isWhite ? Infinity : visibilityData.size[i];
        geometry.addGroup(position, value, 0);
      }
    }
  }
  deleteAttributeEvent(_geometry) {
    function callback() {
      delete this.array;
    }
    return callback;
  }
}
export {
  LODManager
};
//# sourceMappingURL=lod-manager.mjs.map
