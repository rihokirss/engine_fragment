import { VirtualMeshManager } from "./virtual-mesh-manager.mjs";
import { LodClass } from "./types.mjs";
import { ObjectClass, CurrentLod } from "../../model/model-types.mjs";
import { ShellTemplateConstructor } from "./shell/shell-template-constructor.mjs";
import { ShellUtils } from "./shell/shell-utils.mjs";
import { ShellPointRaycaster } from "./shell/shell-point-raycaster.mjs";
import { RepresentationClass } from "../../../../Schema/representation-class.mjs";
import { ShellConstructor } from "./shell/shell-constructor.mjs";
import { ShellFaceRaycaster } from "./shell/shell-face-raycaster.mjs";
import { ShellLineRaycaster } from "./shell/shell-line-raycaster.mjs";
class VirtualShellManager extends VirtualMeshManager {
  _lodClass = LodClass.AABB;
  _objectClass = ObjectClass.SHELL;
  _representationClass = RepresentationClass.SHELL;
  _templates = new ShellTemplateConstructor();
  _constructor = new ShellConstructor();
  _faceRaycaster = new ShellFaceRaycaster(this.meshes);
  _lineRaycaster = new ShellLineRaycaster(this.meshes);
  _pointRaycaster = new ShellPointRaycaster(this.meshes);
  fetchMeshes(meshId, evenVoid) {
    const mesh = this.getMesh(meshId, CurrentLod.GEOMETRY);
    this.constructMesh(mesh, evenVoid, meshId);
    return mesh;
  }
  newMeshTemplate(shell) {
    return this._templates.newMeshTemplate(shell);
  }
  lineRaycast(id, ray, frustum) {
    return this._lineRaycaster.lineRaycast(id, ray, frustum);
  }
  faceRaycast(id, ray) {
    return this._faceRaycaster.faceRaycast(id, ray);
  }
  raycast(id, ray) {
    return this._faceRaycaster.faceRaycast(id, ray);
  }
  pointRaycast(id, _ray, frustum) {
    return this._pointRaycaster.pointRaycast(id, frustum);
  }
  setupTemplates() {
    for (let i = 0, l = this.meshes.shellsLength(); i < l; i++) {
      const poly = ShellUtils.getShell(this.meshes, i);
      this.useMesh(i, this.newMeshTemplate(poly), CurrentLod.GEOMETRY);
    }
  }
  getRepresentation() {
    return this._representationClass;
  }
  getObjectClass() {
    return this._objectClass;
  }
  getLodClass() {
    return this._lodClass;
  }
  isVoidMesh(mesh) {
    if (!Array.isArray(mesh)) {
      return mesh.positionBuffer === void 0;
    }
    return mesh[0].positionBuffer === void 0;
  }
  constructMesh(mesh, evenVoid, meshId) {
    const isVoid = this.isVoidMesh(mesh);
    if (!isVoid || !evenVoid) return;
    const shell = ShellUtils.getShell(this.meshes, meshId);
    this._constructor.construct(shell, mesh);
    this.saveMesh(meshId, mesh, CurrentLod.GEOMETRY);
  }
}
export {
  VirtualShellManager
};
//# sourceMappingURL=virtual-shell-manager.mjs.map
