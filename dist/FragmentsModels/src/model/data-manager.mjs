import { MultiThreadingRequestClass } from "./model-types.mjs";
class DataManager {
  async dispose(model, meshes, alignments, grids, options) {
    meshes.list.delete(model.modelId);
    await this.requestModelDelete(model);
    model.threads.delete(model.modelId);
    if (options?.keepInScene) {
      meshes.materials.releaseModelSlot(model.modelId);
      return;
    }
    model.object.removeFromParent();
    this.deleteAllTiles(model);
    meshes.materials.dispose(model.modelId);
    alignments.dispose();
    grids.dispose();
  }
  async getBuffer(model, raw) {
    return model._invoke("getBuffer", [raw]);
  }
  async getCategories(model) {
    return model._invoke("getCategories");
  }
  async getIndexNames(model) {
    return model._invoke("getIndexNames");
  }
  async getIndexInfo(model, name) {
    return model._invoke("getIndexInfo", [name]);
  }
  async getIndexKeys(model, name) {
    return model._invoke("getIndexKeys", [
      name
    ]);
  }
  async getIndexKey(model, name, index) {
    return model._invoke("getIndexKey", [name, index]);
  }
  async getIndexValues(model, name) {
    return model._invoke("getIndexValues", [name]);
  }
  async hasIndexEntry(model, name, key) {
    return model._invoke("hasIndexEntry", [name, key]);
  }
  async getIndexEntry(model, name, key) {
    return model._invoke("getIndexEntry", [name, key]);
  }
  async getInverseIndexEntry(model, name, value) {
    return model._invoke("getInverseIndexEntry", [
      name,
      value
    ]);
  }
  async getMaxLocalId(model) {
    return model._invoke("getMaxLocalId");
  }
  async getLocalIdsByGuids(model, guids) {
    return model._invoke("getLocalIdsByGuids", [guids]);
  }
  async getLocalIdsFromItemIds(model, itemIds) {
    return model._invoke("getLocalIdsFromItemIds", [itemIds]);
  }
  async getSpatialStructure(model) {
    return model._invoke("getSpatialStructure");
  }
  async getItemsWithGeometry(model) {
    const localIds = await model._invoke(
      "getItemsWithGeometry",
      []
    );
    const items = localIds.map((id) => model.getItem(id));
    return items;
  }
  async getItemsWithGeometryCategories(model) {
    return model._invoke("getItemsWithGeometryCategories", []);
  }
  async getItemsIdsWithGeometry(model) {
    return model._invoke("getItemsWithGeometry", []);
  }
  async getItemDrawChunks(model, localIds) {
    return model._invoke("getItemDrawChunks", [localIds]);
  }
  async getItemsOfCategories(model, categories) {
    const args = [categories];
    const data = await model._invoke("getItemsOfCategories", args);
    return data;
  }
  async getItemsByQuery(model, params, config) {
    const args = [params, config];
    const localIds = await model._invoke("getItemsByQuery", args);
    return localIds;
  }
  async getMetadata(model) {
    return model._invoke("getMetadata", []);
  }
  async getCRS(model) {
    return model._invoke("getCRS", []);
  }
  async getGuidsByLocalIds(model, localIds) {
    return model._invoke("getGuidsByLocalIds", [localIds]);
  }
  async requestModelDelete(model) {
    await model.threads.fetch({
      class: MultiThreadingRequestClass.DELETE_MODEL,
      modelId: model.modelId
    });
  }
  deleteAllTiles(model) {
    for (const [tileId] of model.tiles) {
      model.tiles.delete(tileId);
    }
  }
}
export {
  DataManager
};
//# sourceMappingURL=data-manager.mjs.map
