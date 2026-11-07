import pako from "../../../vendor/pako/dist/pako.esm.mjs";
import { isRawBuffer } from "../utils/misc/buffer.mjs";
import { VirtualFragmentsModel } from "../virtual-model/virtual-fragments-model.mjs";
import { LoadAbortedError } from "../model/model-types.mjs";
class SingleThreadedFragmentsModel {
  _modelId;
  _virtualModel;
  /**
   * The promise of the asynchronous part of the model setup, started by the
   * constructor. See {@link ready}. It is memoized: the setup runs exactly
   * once, no public path can re-trigger it.
   */
  _setup;
  _disposed = false;
  /**
   * The ID of the model.
   */
  get modelId() {
    return this._modelId;
  }
  /**
   * Resolves when the model is fully set up. The constructor starts an
   * asynchronous setup that spans multiple macrotasks; await this before
   * relying on the model being completely initialized.
   *
   * If {@link dispose} is called while the setup is still running, this
   * promise rejects with a {@link LoadAbortedError}. If nobody awaits it,
   * the rejection is already handled internally, so it never surfaces as
   * an unhandled rejection.
   */
  get ready() {
    return this._setup;
  }
  /**
   * The constructor of the fragments model.
   * @param raw - Whether `modelData` is raw (uncompressed) or deflated. If
   * omitted, it is auto-detected from the buffer (see {@link isRawBuffer}).
   */
  constructor(modelId, modelData, raw) {
    this._modelId = modelId;
    const isRaw = raw ?? isRawBuffer(modelData);
    let data = modelData;
    if (!isRaw) {
      data = pako.inflate(modelData);
    }
    this._virtualModel = new VirtualFragmentsModel(
      modelId,
      data,
      void 0
    );
    this._setup = this._virtualModel.setupData(void 0, () => {
      if (this._disposed) {
        throw new LoadAbortedError(this._modelId);
      }
    });
    this._setup.catch(() => {
    });
  }
  /**
   * Dispose the model. Use this when you're done with the model.
   * If you use the {@link FragmentsModels.dispose} method, this will be called automatically for all models.
   *
   * If the setup started by the constructor is still running, it is aborted
   * at its next yield point and {@link ready} rejects with a
   * {@link LoadAbortedError}. Calling this more than once is a no-op.
   */
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._virtualModel.dispose();
    this._virtualModel = null;
  }
  /**
   * Get the spatial structure of the model.
   */
  getSpatialStructure() {
    return this._virtualModel.getSpatialStructure();
  }
  /**
   * Get the local IDs corresponding to the specified GUIDs.
   * @param guids - Array of GUIDs to look up.
   */
  getLocalIdsByGuids(guids) {
    return this._virtualModel.getLocalIdsByGuids(guids);
  }
  /**
   * Translate internal `itemId`s into user-facing `localId`s, preserving
   * order. See {@link VirtualFragmentsModel.getLocalIdsFromItemIds}.
   */
  getLocalIdsFromItemIds(itemIds) {
    return this._virtualModel.getLocalIdsFromItemIds(itemIds);
  }
  /**
   * Get all the categories of the model.
   */
  getCategories() {
    return this._virtualModel.getCategories();
  }
  /**
   * Get the names of every user-defined index stored on this model. See the
   * `ModelIndex` schema for the supported shapes.
   */
  getIndexNames() {
    return this._virtualModel.getIndexNames();
  }
  /**
   * Describe the shape of a named index without performing any lookups.
   * Returns `null` if no index with that name exists.
   */
  getIndexInfo(name) {
    return this._virtualModel.getIndexInfo(name);
  }
  /**
   * Get the keys of an index. Useful for keys-only indexes (membership tests,
   * iteration) but valid for any mode. Number keys come back as a
   * `Uint32Array`, string keys as `string[]`.
   */
  getIndexKeys(name) {
    return this._virtualModel.getIndexKeys(name);
  }
  /**
   * Get key at given index.
   * Useful for keys-only indexes but valid for any mode.
   */
  getIndexKey(name, index) {
    return this._virtualModel.getIndexKey(name, index);
  }
  /**
   * Get the values of an index. Useful for inverse lookups.
   */
  getIndexValues(name) {
    return this._virtualModel.getIndexValues(name);
  }
  /**
   * Test whether a key exists in the named index without resolving its value.
   */
  hasIndexEntry(name, key) {
    return this._virtualModel.hasIndexEntry(name, key);
  }
  /**
   * Forward lookup of a single entry in the named index. The return shape
   * depends on the index mode.
   */
  getIndexEntry(name, key) {
    return this._virtualModel.getIndexEntry(name, key);
  }
  /**
   * Inverse lookup. Returns every key that maps to `value`.
   */
  getInverseIndexEntry(name, value) {
    return this._virtualModel.getInverseIndexEntry(name, value);
  }
  /**
   * @deprecated use {@link getItemsIdsWithGeometry}
   */
  getItemsWithGeometry() {
    return this.getItemsIdsWithGeometry();
  }
  /**
   * Get all the items of the model that have geometry.
   */
  getItemsIdsWithGeometry() {
    return this._virtualModel.getItemsWithGeometry();
  }
  /**
   * Get the metadata of the model.
   */
  getMetadata() {
    return this._virtualModel.getMetadata();
  }
  /**
   * Get the Coordinate Reference System (CRS) data of the model, if available.
   */
  getCRS() {
    return this._virtualModel.getCRS();
  }
  /**
   * Get the GUIDs corresponding to the specified local IDs.
   * @param localIds - Array of local IDs to look up.
   */
  getGuidsByLocalIds(localIds) {
    return this._virtualModel.getGuidsByLocalIds(localIds);
  }
  /**
   * Get the buffer of the model.
   * @param raw - Whether to get the raw buffer. If false, it will be compressed.
   */
  getBuffer(raw = false) {
    return this._virtualModel.getBuffer(raw);
  }
  /**
   * Get a buffer containing only the specified items and their associated geometry.
   * @param localIds - The local IDs of the items to include.
   * @param raw - Whether to get the raw buffer. If false, it will be compressed.
   */
  getSubsetBuffer(localIds, raw = false) {
    return this._virtualModel.getSubsetBuffer(localIds, raw);
  }
  /**
   * Get all the items of the model that belong to the specified category.
   * @param category - The category to look up.
   */
  getItemsOfCategories(categories) {
    return this._virtualModel.getItemsOfCategories(categories);
  }
  /**
   * Get the maximum local ID of the model.
   */
  getMaxLocalId() {
    return this._virtualModel.getMaxLocalId();
  }
  /**
   * Get the spatial structure children of the specified items.
   * @param ids - The IDs of the items to look up.
   */
  getItemsChildren(ids) {
    return this._virtualModel.getItemsChildren(ids);
  }
  /**
   * Get all the data of the specified items.
   * @param ids - The IDs of the items to look up.
   * @param config - The configuration of the items data.
   */
  getItemsData(ids, config) {
    return this._virtualModel.getItemsData(ids, config);
  }
  /**
   * Get the absolute positions of the specified items.
   * @param localIds - The local IDs of the items to look up.
   */
  getPositions(localIds) {
    return this._virtualModel.getPositions(localIds);
  }
  /**
   * Gets coordinates of the model.
   */
  getCoordinates() {
    return this._virtualModel.getCoordinates();
  }
  /**
   * Get geometry data for the specified items.
   * @param localIds - The local IDs of the items to get geometry for.
   * @param lod - The level of detail for the geometry (optional).
   */
  getItemsGeometry(localIds, lod) {
    return this._virtualModel.getItemsGeometry(localIds, lod);
  }
  getItemsVolume(localIds) {
    return this._virtualModel.getItemsVolume(localIds);
  }
  /**
   * Query items based on specified parameters.
   * @param params - The query parameters.
   * @param config - Optional query configuration.
   */
  getItemsByQuery(params, config) {
    return this._virtualModel.getItemsByQuery(params, config);
  }
  /**
   * Gets the section (edges and fills) between the model and a given clipping plane.
   * @param plane - The plane to get the section of.
   * @param localIds - The local IDs of the items to get the section of. If undefined, it will return the section of all items.
   */
  getSection(plane, localIds) {
    return this._virtualModel.getSection(plane, localIds);
  }
  /**
   * Get all the local IDs of the model.
   */
  getLocalIds() {
    return this._virtualModel.getLocalIds();
  }
  /**
   * Gets all the materials IDs of the model.
   */
  getMaterialsIds() {
    return this._virtualModel.getMaterialsIds();
  }
  /**
   * Gets the materials of the model.
   * @param localIds - The local IDs of the materials to get. If undefined, it will return all materials.
   */
  getMaterials(localIds) {
    return this._virtualModel.getMaterials(localIds);
  }
  /**
   * Gets all the representations IDs of the model.
   */
  getRepresentationsIds() {
    return this._virtualModel.getRepresentationsIds();
  }
  /**
   * Gets the representations of the model.
   * @param localIds - The local IDs of the representations to get. If undefined, it will return all representations.
   */
  getRepresentations(localIds) {
    return this._virtualModel.getRepresentations(localIds);
  }
  /**
   * Gets all the local transforms IDs of the model.
   */
  getLocalTransformsIds() {
    return this._virtualModel.getLocalTransformsIds();
  }
  /**
   * Gets the local transforms of the model.
   * @param localIds - The local IDs of the local transforms to get. If undefined, it will return all local transforms.
   */
  getLocalTransforms(localIds) {
    return this._virtualModel.getLocalTransforms(localIds);
  }
  /**
   * Gets all the global transforms IDs of the model.
   */
  getGlobalTransformsIds() {
    return this._virtualModel.getGlobalTransformsIds();
  }
  /**
   * Gets the global transforms of the model.
   * @param localIds - The local IDs of the global transforms to get. If undefined, it will return all global transforms.
   */
  getGlobalTransforms(localIds) {
    return this._virtualModel.getGlobalTransforms(localIds);
  }
  /**
   * Gets all the samples IDs of the model.
   */
  getSamplesIds() {
    return this._virtualModel.getSamplesIds();
  }
  /**
   * Gets the samples of the model.
   * @param localIds - The local IDs of the samples to get. If undefined, it will return all samples.
   */
  getSamples(localIds) {
    return this._virtualModel.getSamples(localIds);
  }
  /**
   * Returns per-tile index-buffer chunks for the given items. Used by
   * outline-style passes that share tile geometry and clip drawing to
   * just the outlined samples. See {@link VirtualFragmentsModel.getItemDrawChunks}.
   */
  getItemDrawChunks(localIds) {
    return this._virtualModel.getItemDrawChunks(localIds);
  }
  /**
   * Gets all the items IDs of the model.
   */
  getItemsIds() {
    return this._virtualModel.getItemsIds();
  }
  /**
   * Gets the items of the model.
   * @param localIds - The local IDs of the items to get. If undefined, it will return all items.
   */
  getItems(localIds) {
    return this._virtualModel.getItems(localIds);
  }
  /**
   * Gets the relations of the model.
   * @param localIds - The local IDs of the relations to get. If undefined, it will return all relations.
   */
  getRelations(localIds) {
    return this._virtualModel.getRelations(localIds);
  }
  /**
   * Gets the global transforms IDs of the items of the model.
   * @param ids - The local IDs of the items to get the global transforms IDs of.
   */
  getGlobalTranformsIdsOfItems(ids) {
    return this._virtualModel.getGlobalTranformsIdsOfItems(ids);
  }
  // ---------------------------------------------------------------------
  // Edit API
  //
  // These are the same edit operations exposed by the multithreaded
  // FragmentsModel / Editor, available here for Node.js environments where
  // the Worker-based pipeline isn't available. Unlike the multithreaded
  // flow, there's no separate "delta model" loaded into a scene — the
  // result of `edit()` is just the delta buffer, which you can hand back
  // to downstream tooling or persist however you want.
  // ---------------------------------------------------------------------
  /**
   * Apply a batch of edit requests. Accumulates onto this model's
   * pending-edit history; call {@link save} to flatten them into a new
   * committed buffer or {@link reset} to discard.
   * @param [raw] whether to return the raw buffer or the the result of {@link pako.deflate}. Defaults to `true`.
   * @returns The delta raw/deflated flatbuffer bytes and the local IDs assigned to
   * any newly-created items.
   */
  edit(requests, raw = true) {
    return this._virtualModel.edit(requests, raw);
  }
  /** Discard all pending edits on this model. */
  reset() {
    this._virtualModel.reset();
  }
  /**
   * Flatten the current pending-edit history into a new committed buffer.
   * @param [raw] whether to return the raw buffer or the the result of {@link pako.deflate}. Defaults to `true`.
   * @returns The raw/deflated flatbuffer bytes of the updated model.
   */
  save(raw = true) {
    return this._virtualModel.save(raw);
  }
  /** Undo the last edit. */
  undo() {
    return this._virtualModel.undo();
  }
  /** Redo the last undone edit. */
  redo() {
    return this._virtualModel.redo();
  }
  /** Get the current edit history (applied requests + undone redo stack). */
  getRequests() {
    return this._virtualModel.getRequests();
  }
  /**
   * Get the requests added since an earlier call (see `Editor.getModelRequestsSince`).
   * @param from - The `count` the earlier call returned.
   * @param generation - The `generation` the earlier call returned.
   */
  getRequestsSince(from = 0, generation = -1) {
    return this._virtualModel.getRequestsSince(from, generation);
  }
  /**
   * Replace the edit history with a caller-provided one. Useful for
   * restoring state from disk.
   */
  setRequests(data) {
    return this._virtualModel.setRequests(data);
  }
  /** Navigate to a specific point in the edit history by index. */
  selectRequest(index) {
    return this._virtualModel.selectRequest(index);
  }
}
export {
  SingleThreadedFragmentsModel
};
//# sourceMappingURL=index.mjs.map
