import { MultiThreadingRequestClass } from "../../model/model-types.mjs";
import { ParserHelper } from "../../utils/geometry/parser-helper.mjs";
import { MaterialUtils } from "../../utils/geometry/material-utils.mjs";
class VirtualMaterialController {
  _modelId;
  _list = [];
  _idsByDefinition = /* @__PURE__ */ new Map();
  _onTransfer;
  // Number of ids taken by the model's own materials. Every id at or above
  // it was allocated by a highlight and can be reclaimed once no item
  // references it any more.
  _modelMaterialCount = 0;
  // Samples grouped by the item they belong to, built on the first call to
  // getItemsMaterialDefinition. `_sampleStarts[item]` to
  // `_sampleStarts[item + 1]` is the range of that item in `_sampleIds`
  // (ascending) and `_sampleMaterials` (the material of each of them).
  // A loaded model never changes its samples: edits are kept as requests and
  // built into a separate delta model, which has its own controller. The
  // index still remembers the buffer it was built from and is rebuilt if
  // another one is passed.
  _indexedBuffer = null;
  _sampleStarts = new Uint32Array(0);
  _sampleIds = new Uint32Array(0);
  _sampleMaterials = new Uint32Array(0);
  constructor(modelId, onTransfer) {
    this._modelId = modelId;
    this._onTransfer = onTransfer;
  }
  update(model) {
    const meshes = model.meshes();
    const matList = [];
    const ids = this.getAll(meshes, matList);
    this._modelMaterialCount = this._list.length;
    return ids;
  }
  /**
   * Drops every highlight definition, returning the id space to the model's
   * own materials. Only call it when no item holds a highlight id any more.
   * The main thread truncates its copy on the next transfer (`firstId`).
   */
  reclaimHighlights() {
    const count = this._modelMaterialCount;
    if (this._list.length <= count) return;
    this._list.length = count;
    for (const [key, id] of this._idsByDefinition) {
      if (id >= count) this._idsByDefinition.delete(key);
    }
  }
  fetch(materialId) {
    return this._list[materialId];
  }
  transfer(materials) {
    const result = this.deduplicateMaterials(materials);
    const { materialDefinitions, ids } = result;
    this.transferMaterialData(materialDefinitions);
    return ids;
  }
  getItemsMaterialDefinition(model, indices, _localIds) {
    const result = [];
    const meshes = model.meshes();
    if (!meshes) return [];
    this.indexSamples(model, meshes);
    const starts = this._sampleStarts;
    let count = 0;
    for (const itemIndex of indices) {
      const start = starts[itemIndex];
      const end = starts[itemIndex + 1];
      if (start === void 0 || end === void 0) continue;
      count += end - start;
    }
    const found = new Uint32Array(count);
    let next = 0;
    for (const itemIndex of indices) {
      const start = starts[itemIndex];
      const end = starts[itemIndex + 1];
      if (start === void 0 || end === void 0) continue;
      for (let i = start; i < end; i++) found[next++] = i;
    }
    const sampleIds = this._sampleIds;
    let sorted = true;
    for (let i = 1; i < count; i++) {
      if (sampleIds[found[i - 1]] > sampleIds[found[i]]) {
        sorted = false;
        break;
      }
    }
    if (!sorted) found.sort((a, b) => sampleIds[a] - sampleIds[b]);
    const sampleMaterials = this._sampleMaterials;
    const map = /* @__PURE__ */ new Map();
    let lastItem = -1;
    let localId = null;
    for (let i = 0; i < count; i++) {
      const position = found[i];
      const itemIndex = meshes.samples(sampleIds[position]).item();
      if (itemIndex !== lastItem) {
        lastItem = itemIndex;
        localId = model.localIds(meshes.meshesItems(itemIndex));
      }
      if (localId === null) continue;
      const materialIndex = sampleMaterials[position];
      let materialItems = map.get(materialIndex);
      if (!materialItems) {
        materialItems = /* @__PURE__ */ new Set();
        map.set(materialIndex, materialItems);
      }
      materialItems.add(localId);
    }
    for (const [materialIndex, localIds] of map.entries()) {
      const material = meshes.materials(materialIndex);
      if (!material) continue;
      const definition = ParserHelper.parseMaterial(material);
      result.push({ localIds: [...localIds], definition });
    }
    return result;
  }
  indexSamples(model, meshes) {
    if (this._indexedBuffer === model.bb) return;
    const itemCount = meshes.meshesItemsLength();
    const sampleCount = meshes.samplesLength();
    const starts = new Uint32Array(itemCount + 1);
    const items = new Uint32Array(sampleCount);
    const materials = new Uint32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const sample = meshes.samples(i);
      const itemIndex = sample.item();
      items[i] = itemIndex;
      materials[i] = sample.material();
      if (itemIndex < itemCount) starts[itemIndex + 1]++;
    }
    for (let i = 0; i < itemCount; i++) starts[i + 1] += starts[i];
    const total = starts[itemCount];
    const sampleIds = new Uint32Array(total);
    const sampleMaterials = new Uint32Array(total);
    const cursor = starts.slice(0, itemCount);
    for (let i = 0; i < sampleCount; i++) {
      const itemIndex = items[i];
      if (itemIndex >= itemCount) continue;
      const position = cursor[itemIndex]++;
      sampleIds[position] = i;
      sampleMaterials[position] = materials[i];
    }
    this._sampleStarts = starts;
    this._sampleIds = sampleIds;
    this._sampleMaterials = sampleMaterials;
    this._indexedBuffer = model.bb;
  }
  deduplicateMaterials(materialDefinition) {
    const ids = [];
    const materialDefinitions = [];
    for (const material of materialDefinition) {
      const key = MaterialUtils.getKey(material);
      let id = this._idsByDefinition.get(key);
      if (id === void 0) {
        id = this._list.length;
        this._list.push(material);
        this._idsByDefinition.set(key, id);
        materialDefinitions.push(material);
      }
      ids.push(id);
    }
    return { materialDefinitions, ids };
  }
  getAll(meshes, materialDefinitions) {
    const count = meshes.materialsLength();
    for (let i = 0; i < count; i++) {
      const matData = meshes.materials(i);
      const definition = ParserHelper.parseMaterial(matData);
      definition.localId = meshes.materialIds(i);
      materialDefinitions.push(definition);
    }
    return this.transfer(materialDefinitions);
  }
  transferMaterialData(materialDefinitions) {
    const firstId = this._list.length - materialDefinitions.length;
    this._onTransfer({
      class: MultiThreadingRequestClass.CREATE_MATERIAL,
      modelId: this._modelId,
      materialDefinitions,
      firstId
    });
  }
}
export {
  VirtualMaterialController
};
//# sourceMappingURL=virtual-material-controller.mjs.map
