import { EditHelper } from "./edit-helper.mjs";
import { ElementsHelper } from "./elements-helper.mjs";
import { Event } from "../../../Utils/event.mjs";
class Editor {
  /**
   * Event triggered when an edit is made.
   */
  onEdit = new Event();
  _editHelper;
  _elementsHelper;
  constructor(core, connection) {
    this._editHelper = new EditHelper(core, connection);
    this._elementsHelper = new ElementsHelper(core);
  }
  /**
   * Edits a Fragments model.
   * @param modelId - The ID of the model to edit.
   * @param actions - The actions to perform on the model.
   * @param config - The configuration for the edit.
   * @returns The IDs of the elements that were edited.
   */
  async edit(modelId, actions, config = {
    removeRedo: true
  }) {
    const ids = await this._editHelper.edit(modelId, actions, config);
    this.onEdit.trigger();
    return ids;
  }
  /**
   * Saves all the edits of the specified Fragments model. Useful for exporting the model with the edits applied. Similar to "Saving" the changes in a BIM app.
   * @param modelId - The ID of the model to save.
   * @returns The requests that were saved.
   */
  async save(modelId) {
    return this._editHelper.save(modelId);
  }
  /**
   * Resets the edits of the specified Fragments model.
   * @param modelId - The ID of the model to reset.
   */
  async reset(modelId) {
    await this._editHelper.reset(modelId);
  }
  /**
   * Gets the requests of the specified Fragments model. Useful for building a history menu.
   * @param modelId - The ID of the model to get the requests from.
   * @returns The requests of the model.
   */
  async getModelRequests(modelId) {
    return this._editHelper.getRequests(modelId);
  }
  /**
   * Gets the requests of the specified Fragments model added since an earlier call.
   * @remarks Reading only what was added keeps a long unsaved session cheap to follow:
   * every request is copied from the worker once. Pass the `count` and `generation` of the
   * previous result. If requests were undone, selected, set or reset since, all of them are
   * returned and `from` is 0. The same happens after `save`, or after the model is disposed
   * and loaded again with the same ID: the log starts again (`save` leaves it empty) under a
   * new `generation`, so check `from` before appending to what was read earlier.
   * @param modelId - The ID of the model to get the requests from.
   * @param from - The `count` of the previous result (0 the first time).
   * @param generation - The `generation` of the previous result (-1 the first time).
   * @returns The requests from `from` on, the request count and the generation of the log.
   */
  async getModelRequestsSince(modelId, from = 0, generation = -1) {
    return this._editHelper.getRequestsSince(modelId, from, generation);
  }
  /**
   * Selects an edit request of the specified Fragments model to set the model in the state it
   * was after the request was applied.
   * @param modelId - The ID of the model to select the request from.
   * @param index - The index of the request to select.
   * @returns The selected request.
   */
  async selectRequest(modelId, index) {
    return this._editHelper.selectRequest(modelId, index);
  }
  /**
   * Clears all the element edit requests of the specified Fragments model.
   * @param modelId - The ID of the model to clear the requests from.
   */
  clearElementsRequests(modelId) {
    return this._elementsHelper.getRequests(modelId);
  }
  /**
   * Creates a material in the specified Fragments model.
   * @param modelId - The ID of the model to create the material in.
   * @param material - The material to create.
   * @returns The created material.
   */
  createMaterial(modelId, material) {
    return this._elementsHelper.createMaterial(modelId, material);
  }
  /**
   * Creates a local transform in the specified Fragments model.
   * @param modelId - The ID of the model to create the local transform in.
   * @param transform - The local transform to create.
   * @returns The created local transform.
   */
  createLocalTransform(modelId, transform) {
    return this._elementsHelper.createLocalTransform(modelId, transform);
  }
  /**
   * Creates a shell in the specified Fragments model.
   * @param modelId - The ID of the model to create the shell in.
   * @param geometry - The geometry of the shell to create.
   * @returns The created shell.
   */
  createShell(modelId, geometry) {
    return this._elementsHelper.createShell(modelId, geometry);
  }
  /**
   * Creates a circle extrusion in the specified Fragments model.
   * @param modelId - The ID of the model to create the circle extrusion in.
   * @param data - The data of the circle extrusion to create.
   * @returns The created circle extrusion.
   */
  createCircleExtrusion(modelId, data) {
    return this._elementsHelper.createCircleExtrusion(modelId, data);
  }
  /**
   * Creates a global transform in the specified Fragments model.
   * @param modelId - The ID of the model to create the global transform in.
   * @param transform - The global transform to create.
   * @param itemId - The ID of the item to create the global transform for.
   * @returns The created global transform.
   */
  createGlobalTransform(modelId, transform, itemId) {
    return this._elementsHelper.createGlobalTransform(
      modelId,
      transform,
      itemId
    );
  }
  /**
   * Creates a sample in the specified Fragments model.
   * @param modelId - The ID of the model to create the sample in.
   * @param data - The data of the sample to create.
   * @returns The created sample.
   */
  createSample(modelId, data) {
    return this._elementsHelper.createSample(modelId, data);
  }
  /**
   * Creates an item in the specified Fragments model.
   * @param modelId - The ID of the model to create the item in.
   * @param item - The item to create.
   * @returns The created item.
   */
  createItem(modelId, item) {
    return this._elementsHelper.createItem(modelId, item);
  }
  /**
   * Queues a CREATE_INDEX request on the specified model. The new index is
   * persisted on the next `applyChanges()` call. See `RawIndexData` for the
   * supported shapes (keys-only, 1:1, 1:N linear, 1:N nonlinear).
   *
   * Live reads via `model.getIndexEntry` see the pending index immediately;
   * `applyChanges` makes it survive a save/reload cycle.
   */
  createIndex(modelId, data) {
    this._elementsHelper.createIndex(modelId, data);
  }
  /**
   * Queues an UPDATE_INDEX request. Replaces the index identified by
   * `data.name` in its entirety. Use `deleteIndex` + `createIndex` if you
   * want to rename.
   */
  updateIndex(modelId, data) {
    this._elementsHelper.updateIndex(modelId, data);
  }
  /**
   * Queues a DELETE_INDEX request. No-op at flush time if the named index
   * doesn't exist on the model.
   */
  deleteIndex(modelId, name) {
    this._elementsHelper.deleteIndex(modelId, name);
  }
  /**
   * Sets an item in the specified Fragments model.
   * @param modelId - The ID of the model to set the item in.
   * @param item - The item to set.
   * @returns The set item.
   */
  setItem(modelId, item) {
    return this._elementsHelper.setItem(modelId, item);
  }
  /**
   * Relates an item to other items in the specified Fragments model.
   * @param modelId - The ID of the model to relate the item in.
   * @param itemId - The ID of the item to relate.
   * @param relationName - The name of the relation to relate.
   * @param itemIds - The IDs of the items to relate.
   * @returns The related items.
   */
  async relate(modelId, itemId, relationName, itemIds) {
    return this._elementsHelper.relate(modelId, itemId, relationName, itemIds);
  }
  /**
   * Removes a relation between an item and other items in the specified Fragments model.
   * @param modelId - The ID of the model to unrelate the item in.
   * @param itemId - The ID of the item to unrelate.
   * @param relationName - The name of the relation to unrelate.
   * @param itemIds - The IDs of the items to unrelate.
   * @returns The unrelated items.
   */
  async unrelate(modelId, itemId, relationName, itemIds) {
    return this._elementsHelper.unrelate(
      modelId,
      itemId,
      relationName,
      itemIds
    );
  }
  /**
   * Gets the elements of the specified Fragments model.
   * @param modelId - The ID of the model to get the elements from.
   * @param localIds - The local IDs of the elements to get.
   * @returns The elements of the model.
   */
  async getElements(modelId, localIds) {
    return this._elementsHelper.get(modelId, localIds);
  }
  /**
   * Creates elements in the specified Fragments model.
   * @param modelId - The ID of the model to create the elements in.
   * @param elements - The elements to create.
   * @returns The created elements.
   */
  async createElements(modelId, elements) {
    return this._elementsHelper.create(modelId, elements);
  }
  /**
   * Deletes elements in the specified Fragments model.
   * @param modelId - The ID of the model to delete the elements in.
   * @param elements - The elements to delete.
   * @returns The deleted elements.
   */
  deleteElements(modelId, elements) {
    return this._elementsHelper.delete(modelId, elements);
  }
  /**
   * Applies changes to the specified Fragments model.
   * @param modelId - The ID of the model to apply the changes to.
   * @param elements - The elements to apply the changes to.
   * @returns The applied changes.
   */
  async applyChanges(modelId, elements = []) {
    return this._elementsHelper.applyChanges(modelId, elements);
  }
  /**
   * Deletes any type of data from the specified Fragments model.
   * @param modelId - The ID of the model to delete the data from.
   * @param data - The data to delete.
   * @returns The deleted data.
   */
  async deleteData(modelId, data) {
    return this._elementsHelper.deleteData(modelId, data);
  }
  /**
   * Internal method to update the specified Fragments model. Do not use this method directly.
   * @param modelId - The ID of the model to update.
   */
  async _update(modelId) {
    await this._editHelper._update(modelId);
  }
}
export {
  Editor
};
//# sourceMappingURL=editor.mjs.map
