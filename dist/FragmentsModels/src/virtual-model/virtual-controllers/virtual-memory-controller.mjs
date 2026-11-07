import { LRUCache } from "../../../../vendor/lru-cache/dist/esm/index.mjs";
class VirtualMemoryController {
  static oneHundredMb = 1e8;
  static _meshes = this.setupMeshes();
  static _capacity;
  static _memoryAttributes = [
    "positionBuffer",
    "indexBuffer",
    "normalBuffer"
  ];
  static get(id) {
    return this._meshes.get(id);
  }
  static lockIn(mesh) {
    Object.seal(mesh);
  }
  static add(id, mesh) {
    this._meshes.set(id, mesh);
  }
  static delete(ids) {
    for (const id of ids) {
      this._meshes.delete(id);
    }
  }
  static updateMeshMemory = (mesh) => {
    mesh.usedMemory = 0;
    for (const key of this._memoryAttributes) {
      if (mesh.usedMemory !== void 0 && mesh[key]) {
        mesh.usedMemory += mesh[key].byteLength;
      }
    }
    this.lockIn(mesh);
  };
  static setCapacity(value) {
    if (value === this._capacity) return;
    this._meshes.clear();
    this._meshes = this.setupMeshes(value);
    this._capacity = value;
  }
  static setupMeshes(size) {
    const maxSize = Math.max(size ?? this.computeCapacity(), 1);
    const sizeCalculation = this.getSizeCalculationEvent();
    const lruInput = { maxSize, sizeCalculation };
    return new LRUCache(lruInput);
  }
  static computeCapacity() {
    const deviceMemory = globalThis.navigator && "deviceMemory" in globalThis.navigator ? globalThis.navigator.deviceMemory : null;
    const fallbackMemory = 2;
    const baseMemory = deviceMemory !== null ? deviceMemory : fallbackMemory;
    const result = this.oneHundredMb * baseMemory;
    return Math.trunc(result);
  }
  static getDataSetMemory(mesh) {
    let usedMemory = 0;
    for (const item of mesh) {
      usedMemory += item.usedMemory;
    }
    return Math.max(usedMemory, 1);
  }
  static getSizeCalculationEvent() {
    return (mesh) => {
      if (!Array.isArray(mesh)) {
        return Math.max(mesh.usedMemory, 1);
      }
      return this.getDataSetMemory(mesh);
    };
  }
}
export {
  VirtualMemoryController
};
//# sourceMappingURL=virtual-memory-controller.mjs.map
