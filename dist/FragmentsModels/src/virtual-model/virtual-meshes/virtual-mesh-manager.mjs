import { VirtualTemplateController } from "../virtual-controllers/virtual-template-controller.mjs";
import { VirtualMemoryController } from "../virtual-controllers/virtual-memory-controller.mjs";
import { CRC } from "../../utils/misc/crc.mjs";
import { MiscHelper } from "../../utils/misc/misc-helper.mjs";
class VirtualMeshManager {
  meshes;
  _templateController = new VirtualTemplateController();
  _meshIds = /* @__PURE__ */ new Set();
  _idGenerator = new CRC();
  _modelCode;
  constructor(modelId, meshes) {
    this.meshes = meshes;
    this._modelCode = this.getModelCode(modelId);
  }
  dispose() {
    VirtualMemoryController.delete(this._meshIds);
  }
  useMesh(id, mesh, lod) {
    const code = this.meshCode(id, lod);
    VirtualMemoryController.lockIn(mesh);
    this._templateController.add(code, mesh);
  }
  getMesh(id, lod) {
    const code = this.meshCode(id, lod);
    const geometry = VirtualMemoryController.get(code);
    return geometry ?? this._templateController.get(code);
  }
  saveMesh(id, mesh, lod) {
    MiscHelper.forEach(mesh, VirtualMemoryController.updateMeshMemory);
    const code = this.meshCode(id, lod);
    VirtualMemoryController.add(code, mesh);
    this._meshIds.add(code);
  }
  meshCode(index, lod) {
    const code = this._modelCode;
    const repr = this.getRepresentation();
    const data = [code, repr, lod, index];
    return this._idGenerator.generate(data);
  }
  getModelCode(modelId) {
    return this._idGenerator.generate([modelId]);
  }
}
export {
  VirtualMeshManager
};
//# sourceMappingURL=virtual-mesh-manager.mjs.map
