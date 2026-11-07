import { LodClass } from "./types.mjs";
import { ObjectClass, CurrentLod } from "../../model/model-types.mjs";
import { VirtualMeshManager } from "./virtual-mesh-manager.mjs";
import { VceConstructor } from "./circle-extrusion/vce-constructor.mjs";
import { VceLodConstructor } from "./circle-extrusion/vce-lod-constructor.mjs";
import { VceRaycaster } from "./circle-extrusion/vce-raycaster.mjs";
import { VceLineRaycaster } from "./circle-extrusion/vce-line-raycaster.mjs";
import { VcePointRaycaster } from "./circle-extrusion/vce-point-raycaster.mjs";
import { RepresentationClass } from "../../../../Schema/representation-class.mjs";
import { VceUtils } from "./circle-extrusion/vce-utils.mjs";
class VirtualCircleExtrusionManager extends VirtualMeshManager {
  _vceConstructor = new VceConstructor();
  _lodConstructor = new VceLodConstructor();
  _vceRaycaster = new VceRaycaster(this.meshes);
  _vceLineRaycaster = new VceLineRaycaster(this.meshes);
  _vcePointRaycaster = new VcePointRaycaster(this.meshes);
  _representationClass = RepresentationClass.CIRCLE_EXTRUSION;
  _objectClass = ObjectClass.LINE;
  lodClass = LodClass.CUSTOM;
  setupTemplates() {
    const count = this.meshes.circleExtrusionsLength();
    for (let id = 0; id < count; id++) {
      this.newCircleExtrusionTemplate(id);
    }
  }
  fetchLod(meshId, evenVoid) {
    const lod = this.getMesh(meshId, CurrentLod.WIRES);
    this.generateLodIfNeeded(meshId, evenVoid, lod);
    return lod;
  }
  fetchMeshes(meshId, evenVoid) {
    const meshes = this.getMesh(meshId, CurrentLod.GEOMETRY);
    this.generateMeshesIfNeeded(meshId, evenVoid, meshes);
    return meshes;
  }
  raycast(id, ray) {
    return this._vceRaycaster.raycast(id, ray);
  }
  faceRaycast() {
    return [];
  }
  pointRaycast(id, ray) {
    return this._vcePointRaycaster.pointRaycast(id, ray);
  }
  lineRaycast(id, ray) {
    return this._vceLineRaycaster.lineRaycast(id, ray);
  }
  getObjectClass() {
    return this._objectClass;
  }
  getRepresentation() {
    return this._representationClass;
  }
  getLodClass() {
    return this.lodClass;
  }
  newMeshes(meshId, meshes) {
    this.meshes.circleExtrusions(meshId, VceUtils.temp.circleExtrusion);
    const circleExtrusion = VceUtils.temp.circleExtrusion;
    this._vceConstructor.construct(circleExtrusion, meshes);
    this.saveMesh(meshId, meshes, CurrentLod.GEOMETRY);
  }
  generateMeshesIfNeeded(meshId, createIfVoid, meshes) {
    if (meshes.length === 0) {
      return;
    }
    const meshesExist = Boolean(meshes.length);
    const isVoid = !meshes[0].positionBuffer;
    const shouldCreate = createIfVoid && isVoid && meshesExist;
    if (shouldCreate) {
      this.newMeshes(meshId, meshes);
    }
  }
  newCircleExtrusionTemplate(id) {
    const meshTemplate = [];
    this.meshes.circleExtrusions(id, VceUtils.temp.circleExtrusion);
    const circleExtrusion = VceUtils.temp.circleExtrusion;
    const count = circleExtrusion.axesLength();
    for (let i = 0; i < count; i++) {
      this._vceConstructor.newTemplate(circleExtrusion, i, meshTemplate);
    }
    const lodTemplate = this._lodConstructor.newTemplate();
    this.useMesh(id, meshTemplate, CurrentLod.GEOMETRY);
    this.useMesh(id, lodTemplate, CurrentLod.WIRES);
  }
  generateLodIfNeeded(meshId, evenVoid, mesh) {
    const isVoid = !mesh.positionBuffer;
    if (!isVoid || !evenVoid) return;
    this.meshes.circleExtrusions(meshId, VceUtils.temp.circleExtrusion);
    this._lodConstructor.construct(VceUtils.temp.circleExtrusion, mesh);
    this.saveMesh(meshId, mesh, CurrentLod.WIRES);
  }
}
export {
  VirtualCircleExtrusionManager
};
//# sourceMappingURL=virtual-circle-extrusion-manager.mjs.map
