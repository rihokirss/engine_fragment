import { Element } from "../edit/element.mjs";
class EditManager {
  async edit(model, requests) {
    return model._invoke("edit", [requests]);
  }
  async reset(model) {
    return model._invoke("reset", []);
  }
  async save(model) {
    return model._invoke("save", []);
  }
  async getItemsGeometry(model, localIds, lod) {
    const originalGeometries = await model._invoke("getItemsGeometry", [
      localIds,
      lod
    ]);
    const deltaModel = model._getDeltaModel();
    if (!deltaModel) {
      return originalGeometries;
    }
    const deltaGeometries = await deltaModel._invoke("getItemsGeometry", [
      localIds
    ]);
    const geomsByLocalId = /* @__PURE__ */ new Map();
    for (const geometry of originalGeometries) {
      const localId = geometry[0].localId;
      geomsByLocalId.set(localId, geometry);
    }
    for (const geometry of deltaGeometries) {
      const localId = geometry[0].localId;
      geomsByLocalId.set(localId, geometry);
    }
    return Array.from(geomsByLocalId.values());
  }
  async getGeometries(model, ids) {
    const originalGeometries = await model._invoke("getGeometries", [
      ids
    ]);
    const deltaModel = model._getDeltaModel();
    if (!deltaModel) {
      return originalGeometries;
    }
    const deltaGeometries = await deltaModel._invoke("getGeometries", [
      ids
    ]);
    const geomsByReprId = /* @__PURE__ */ new Map();
    for (const geometry of originalGeometries) {
      const reprId = geometry.representationId;
      geomsByReprId.set(reprId, geometry);
    }
    for (const geometry of deltaGeometries) {
      const reprId = geometry.representationId;
      geomsByReprId.set(reprId, geometry);
    }
    return Array.from(geomsByReprId.values());
  }
  async getMaterialsIds(model) {
    return model._invoke("getMaterialsIds", []);
  }
  async getMaterials(model, localIds) {
    return model._invoke("getMaterials", [localIds]);
  }
  async getSamplesIds(model) {
    return model._invoke("getSamplesIds", []);
  }
  async getSamples(model, localIds) {
    return model._invoke("getSamples", [localIds]);
  }
  async getRepresentationsIds(model) {
    return model._invoke("getRepresentationsIds", []);
  }
  async getRepresentations(model, localIds) {
    return model._invoke("getRepresentations", [localIds]);
  }
  async getLocalTransformsIds(model) {
    return model._invoke("getLocalTransformsIds", []);
  }
  async getLocalTransforms(model, localIds) {
    return model._invoke("getLocalTransforms", [localIds]);
  }
  async getGlobalTransformsIds(model) {
    return model._invoke("getGlobalTransformsIds", []);
  }
  async getGlobalTransforms(model, localIds) {
    return model._invoke("getGlobalTransforms", [localIds]);
  }
  async getItemsIds(model) {
    return model._invoke("getItemsIds", []);
  }
  async getItems(model, localIds) {
    return model._invoke("getItems", [localIds]);
  }
  async getRelations(model, localIds) {
    return model._invoke("getRelations", [localIds]);
  }
  async getGlobalTranformsIdsOfItems(model, ids) {
    const items = await model._invoke("getGlobalTranformsIdsOfItems", [
      ids
    ]);
    return items;
  }
  async getEditedElements(model) {
    const deltaModel = model._getDeltaModel();
    if (!deltaModel) {
      return [];
    }
    return deltaModel._invoke("getItemsWithGeometry", []);
  }
  /**
   * Fast snap-only fetch keyed by `itemId` — the FlatBuffer
   * `sample.item()` index that the GPU picker now writes into the
   * per-vertex `id` attribute. Returns just the data the snap path
   * needs (samples, transforms, SHELL representations); skips the
   * whole-sample-table scan that `getElements` does.
   *
   * Returns `null` if the item has no shells (e.g. line-only items).
   */
  async getItemSnapData(model, itemId) {
    return model._invoke("getItemSnapData", [
      itemId
    ]);
  }
  async getElements(model, localIds) {
    const itemsData = await model._invoke("getElementsData", [localIds]);
    const deltaModel = model._getDeltaModel();
    if (deltaModel) {
      const updatedItems = await deltaModel._invoke("getElementsData", [
        localIds
      ]);
      for (const id in updatedItems) {
        itemsData[id] = updatedItems[id];
      }
    }
    const result = [];
    for (const id in itemsData) {
      const element = new Element(Number(id), itemsData[id], model);
      result.push(element);
    }
    return result;
  }
  async getRequests(model) {
    return model._invoke("getRequests", []);
  }
  async getRequestsSince(model, from, generation) {
    return model._invoke("getRequestsSince", [
      from,
      generation
    ]);
  }
  async setRequests(model, data) {
    return model._invoke("setRequests", [data]);
  }
  async selectRequest(model, index) {
    return model._invoke("selectRequest", [index]);
  }
}
export {
  EditManager
};
//# sourceMappingURL=edit-manager.mjs.map
