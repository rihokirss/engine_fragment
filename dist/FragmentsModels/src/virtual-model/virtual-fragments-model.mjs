import "../../../vendor/flatbuffers/mjs/utils.mjs";
import "../../../vendor/flatbuffers/mjs/encoding.mjs";
import { ByteBuffer } from "../../../vendor/flatbuffers/mjs/byte-buffer.mjs";
import * as THREE from "three";
import pako from "../../../vendor/pako/dist/pako.esm.mjs";
import { CurrentLod } from "../model/model-types.mjs";
import { GridsController } from "./virtual-controllers/grids-controller.mjs";
import { EditRequestIndex } from "./edit-request-index.mjs";
import { RaycastHelper } from "./virtual-helpers/raycast-helper.mjs";
import { CoordinatesHelper } from "./virtual-helpers/coordinates-helper.mjs";
import { HighlightHelper } from "./virtual-helpers/highlight-helper.mjs";
import { VisibilityHelper } from "./virtual-helpers/visibility-helper.mjs";
import { GeometryHelper } from "./virtual-helpers/geometry-helper.mjs";
import { SectionHelper } from "./virtual-helpers/section-helper.mjs";
import { ItemsHelper } from "./virtual-helpers/items-helper.mjs";
import { SequenceHelper } from "./virtual-helpers/sequence-helper.mjs";
import { VirtualBoxController } from "../bounding-boxes/virtual-box-controller.mjs";
import { AlignmentsController } from "./virtual-controllers/alignments-controller.mjs";
import { VirtualIndexesController } from "./virtual-controllers/virtual-indexes-controller.mjs";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "../../../vendor/three-mesh-bvh/src/utils/ExtensionUtilities.mjs";
import { VirtualPropertiesController } from "./virtual-controllers/virtual-properties-controller.mjs";
import { RaycastController } from "./virtual-controllers/raycast-controller.mjs";
import { VirtualMaterialController } from "./virtual-controllers/virtual-material-controller.mjs";
import { VirtualTilesController } from "./virtual-controllers/virtual-tiles-controller.mjs";
import { Model } from "../../../Schema/model.mjs";
import { ItemConfigController } from "./virtual-controllers/item-config-controller.mjs";
import { EditUtils } from "../../../Utils/edit/edit-utils.mjs";
import { EditRequestType } from "../../../Utils/edit/edit-types.mjs";
class VirtualFragmentsModel {
  data;
  view;
  raycaster;
  itemConfig;
  properties;
  materials;
  tiles;
  boxes;
  indexes;
  requests = [];
  _requestIndex = new EditRequestIndex();
  _raycastHelper = new RaycastHelper();
  _coordinatesHelper = new CoordinatesHelper();
  _highlightHelper = new HighlightHelper();
  _visibilityHelper = new VisibilityHelper();
  _geometryHelper = new GeometryHelper();
  _sectionHelper = new SectionHelper();
  _itemsHelper = new ItemsHelper();
  _sequenceHelper = new SequenceHelper(this);
  _config = {};
  _modelId;
  _alignments;
  _grids;
  _connection;
  _reprIdMap = /* @__PURE__ */ new Map();
  _nextId = 0;
  _requestsForRedo = [];
  // Changes whenever `requests` changes other than by appending (see getRequestsSince).
  // Starts at a random 32-bit integer, not 0, so a generation read before a save or reload
  // does not match the model loaded under the same id (a counter would repeat across workers).
  _requestsGeneration = Math.floor(Math.random() * 4294967296);
  constructor(modelId, data, connection, config) {
    this._modelId = modelId;
    this._connection = connection;
    this._config = { ...this._config, ...config };
    this.data = this.setupModel(data);
    this.boxes = new VirtualBoxController(this.data);
    this.materials = this.setupMaterials(modelId);
    this._alignments = new AlignmentsController(this);
    this._grids = new GridsController(this);
    this.itemConfig = this.setupItemsConfig();
    this.tiles = this.setupTiles();
    this.properties = this.setupProperties();
    this.raycaster = this.setupRaycaster();
    this.indexes = new VirtualIndexesController(this);
    this.setupBVH();
    this._nextId = this.getMaxLocalId();
  }
  // ---------------------------------------------------------------------------
  // User-defined indexes (see ModelIndex schema)
  // ---------------------------------------------------------------------------
  getIndexNames() {
    return this.indexes.getNames();
  }
  getIndexInfo(name) {
    return this.indexes.getInfo(name);
  }
  getIndexKeys(name) {
    return this.indexes.getKeys(name);
  }
  getIndexKey(name, index) {
    return this.indexes.getKey(name, index);
  }
  getIndexValues(name) {
    return this.indexes.getValues(name);
  }
  hasIndexEntry(name, key) {
    return this.indexes.has(name, key);
  }
  getIndexEntry(name, key) {
    return this.indexes.getEntry(name, key);
  }
  getInverseIndexEntry(name, value) {
    return this.indexes.getInverseEntry(
      name,
      value
    );
  }
  getItemsByConfig(condition) {
    return this._itemsHelper.getItemsByConfig(this, condition);
  }
  getItemsCategories(ids) {
    return this.properties.getItemsCategories(ids);
  }
  // Item.getCategory() dispatches "getItemCategory" through the worker, so
  // this wrapper must exist here (#267). Unknown ids are skipped by
  // getItemsCategories, leaving an empty array, hence the null fallback.
  getItemCategory(id) {
    return this.getItemsCategories([id])[0] ?? null;
  }
  getItemIdsByLocalIds(localIds) {
    return this.properties.getItemIdsFromLocalIds(localIds);
  }
  getItemAttributes(id) {
    return this.properties.getItemAttributes(id);
  }
  // getItemsAttributes(ids: number[]) {
  //   return this.properties.getItemsAttributes(ids);
  // }
  getAttributesUniqueValues(config) {
    return this.properties.getAttributesUniqueValues(config);
  }
  getItemsData(ids, config) {
    return this.properties.getItemsData(ids, config);
  }
  getItemsOfCategories(categories) {
    return this.properties.getItemsOfCategories(categories);
  }
  getItemsWithGeometry() {
    return this.properties.getItemsWithGeometry();
  }
  getItemsWithGeometryCategories() {
    return this.properties.getItemsWithGeometryCategories();
  }
  getItemsByQuery(params, config) {
    return this.properties.getItemsByQuery(params, config);
  }
  getItemRelations(id) {
    return this.properties.getItemRelations(id);
  }
  getSpatialStructure() {
    const found = EditUtils.applyChangesToSpecialData(
      this.requests,
      "SPATIAL_STRUCTURE"
    );
    if (found) {
      return found;
    }
    return this.properties.getSpatialStructure();
  }
  getMaxLocalId() {
    return this.properties.getMaxLocalId();
  }
  getCategories() {
    return this.properties.getCategories();
  }
  getMetadata() {
    const found = EditUtils.applyChangesToSpecialData(
      this.requests,
      "METADATA"
    );
    if (found) {
      return found;
    }
    return this.properties.getMetadata();
  }
  getCRS() {
    const found = EditUtils.applyChangesToSpecialData(
      this.requests,
      "METADATA"
    );
    if (found && found.crs) {
      return found.crs;
    }
    return this.properties.getCRS();
  }
  getLocalIdsByGuids(guids) {
    return this.properties.getLocalIdsByGuids(guids);
  }
  getGuidsByLocalIds(localIds) {
    return this.properties.getGuidsByLocalIds(localIds);
  }
  /**
   * Returns the user-facing `localId` for each internal `itemId`,
   * preserving order. Used by GPU-readback pickers that recover item
   * ids from the per-vertex `id` attribute and need to translate to
   * the public id space.
   */
  getLocalIdsFromItemIds(itemIds) {
    return this.properties.getLocalIdsFromItemIds(itemIds);
  }
  getSequenced(result, fromItems, inputs) {
    return this._sequenceHelper.getSequenced(result, fromItems, inputs);
  }
  highlight(items, highlightMaterial) {
    this._highlightHelper.highlight(this, items, highlightMaterial);
  }
  setColor(items, color) {
    this._highlightHelper.setColor(this, items, color);
  }
  resetColor(items) {
    this._highlightHelper.resetColor(this, items);
  }
  setOpacity(items, opacity) {
    this._highlightHelper.setOpacity(this, items, opacity);
  }
  resetOpacity(items) {
    this._highlightHelper.resetOpacity(this, items);
  }
  getHighlight(localIds) {
    return this._highlightHelper.getHighlight(this, localIds);
  }
  getHighlightItemIds() {
    return this._highlightHelper.getHighlightItems(this);
  }
  resetHighlight(items) {
    this._highlightHelper.resetHighlight(this, items);
  }
  /**
   * For every loaded tile that contains at least one of the given local
   * ids, returns the index-buffer chunks those items occupy in the tile.
   * Used to draw outline silhouettes by sharing the tile's geometry
   * attributes and limiting drawing to the returned chunks via
   * `geometry.groups`.
   *
   * @returns One entry per affected tile. Each entry has parallel
   *   `position` and `size` Uint32Arrays giving start index and count.
   */
  getItemDrawChunks(localIds) {
    const itemIds = this.properties.getItemIdsFromLocalIds(localIds);
    return this.tiles.getDrawChunksForItems(new Set(itemIds));
  }
  getCoordinates() {
    return this._coordinatesHelper.getCoordinates(this);
  }
  getPositions(localIds) {
    return this._coordinatesHelper.getPositions(this, localIds);
  }
  getGeometriesLength() {
    return this._geometryHelper.getGeometriesLength(this);
  }
  getGuids() {
    return this.properties.getGuids();
  }
  getLocalIds() {
    return this.properties.getLocalIds();
  }
  getItemsGeometry(localIds, lod = CurrentLod.GEOMETRY) {
    const indices = this.properties.getItemIdsFromLocalIds(localIds);
    const geometries = [];
    for (const index of indices) {
      const geometry = this._geometryHelper.getSampleGeometry(this, index, lod);
      geometries.push(geometry);
    }
    return geometries;
  }
  getGeometries(reprsLocalIds) {
    if (this._reprIdMap.size === 0) {
      const meshes2 = this.data.meshes();
      for (let i = 0; i < meshes2.representationsLength(); i++) {
        const localId = meshes2.representationIds(i);
        this._reprIdMap.set(localId, i);
      }
    }
    const indices = /* @__PURE__ */ new Map();
    for (const localId of reprsLocalIds) {
      if (this._reprIdMap.has(localId)) {
        indices.set(localId, this._reprIdMap.get(localId));
      }
    }
    const meshes = this.data.meshes();
    const reprsIndices = Array.from(indices.values());
    const result = [];
    for (const index of reprsIndices) {
      const geoms = this.tiles.fetchGeometry(index);
      const items = Array.isArray(geoms) ? geoms : [geoms];
      for (const found of items) {
        const indices2 = found.indexBuffer;
        const positions = found.positionBuffer;
        const normals = found.normalBuffer;
        const representationId = meshes.representationIds(index);
        result.push({
          transform: new THREE.Matrix4(),
          indices: indices2,
          positions,
          normals,
          representationId
        });
      }
    }
    return result;
  }
  getItemsVolume(localIds) {
    const indices = this.properties.getItemIdsFromLocalIds(localIds);
    let volume = 0;
    for (const index of indices) {
      volume += this._geometryHelper.getVolume(this, index);
    }
    return volume;
  }
  getAttributeNames() {
    const names = this.properties.getAttributeNames();
    return names;
  }
  getAttributeValues() {
    const values = this.properties.getAttributeValues();
    return values;
  }
  getAttributeTypes() {
    const types = this.properties.getAttributeTypes();
    return types;
  }
  getRelationNames() {
    const names = this.properties.getRelationNames();
    return names;
  }
  getItemsMaterialDefinition(localIds) {
    const indices = this.properties.getItemIdsFromLocalIds(localIds);
    return this.materials.getItemsMaterialDefinition(
      this.data,
      indices,
      localIds
    );
  }
  resetVisible() {
    this._visibilityHelper.resetVisible(this);
  }
  getItemsByVisibility(visible) {
    return this._visibilityHelper.getItemsByVisibility(this, visible);
  }
  raycast(ray, frustum, returnAll) {
    return this._raycastHelper.raycast(this, ray, frustum, returnAll);
  }
  snapRaycast(ray, frustum, snaps) {
    return this._raycastHelper.snapRaycast(this, ray, frustum, snaps);
  }
  rectangleRaycast(frustum, fullyIncluded) {
    return this._raycastHelper.rectangleRaycast(this, frustum, fullyIncluded);
  }
  getSection(plane, localIds) {
    const indices = this.properties.getItemIdsFromLocalIds(localIds);
    return this._sectionHelper.getSection(this, plane, indices);
  }
  getAlignments() {
    return this._alignments.getAlignments();
  }
  getGrids() {
    return this._grids.getGrids();
  }
  getBuffer(raw) {
    const bb = this.data.bb;
    const bytes = bb.bytes();
    const buffer = bytes.buffer;
    return raw ? buffer : pako.deflate(buffer);
  }
  getSubsetBuffer(localIds, raw) {
    const localIdToIndex = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.data.localIdsLength(); i++) {
      localIdToIndex.set(this.data.localIds(i), i);
    }
    const itemIndices = /* @__PURE__ */ new Set();
    for (const localId of localIds) {
      const index = localIdToIndex.get(localId);
      if (index !== void 0) {
        itemIndices.add(index);
      }
    }
    const items = EditUtils.getItems(this.data, itemIndices);
    const requests = [];
    for (const [localId, itemData] of items) {
      requests.push({
        type: EditRequestType.UPDATE_ITEM,
        localId,
        data: itemData
      });
    }
    const { model } = EditUtils.edit(this.data, requests, {
      raw,
      delta: true
    });
    return model;
  }
  dispose() {
    this.tiles.dispose();
  }
  setVisible(localIds, visible) {
    this._visibilityHelper.setVisible(this, localIds, visible);
  }
  toggleVisible(localIds) {
    this._visibilityHelper.toggleVisible(this, localIds);
  }
  getVisible(items) {
    return this._visibilityHelper.getVisible(this, items);
  }
  hideForEdit(localIds) {
    this._visibilityHelper.hideForEdit(this, localIds);
  }
  clearHiddenForEdit() {
    this._visibilityHelper.clearHiddenForEdit();
  }
  getItemsChildren(ids) {
    return this.properties.getItemsChildren(ids);
  }
  async setupData(onProgress, throwIfAborted) {
    await this.tiles.generate(onProgress, throwIfAborted);
  }
  refreshView(view) {
    this.view = view;
    this.tiles.setupView(view);
  }
  getFullBBox() {
    return this.boxes.fullBox;
  }
  getBBoxes(items) {
    const box = new THREE.Box3();
    this.properties.getBox(items, box);
    return box;
  }
  traverse(itemIds, onItem) {
    this._itemsHelper.traverse(this, itemIds, onItem);
  }
  update(time) {
    this.tiles.update(time);
    return this.tiles.tilesUpdated;
  }
  /**
   * Per-localId lookup over the pending requests, used by the property reads
   * instead of scanning the whole requests list per item.
   */
  get requestIndex() {
    this._requestIndex.sync(this.requests);
    return this._requestIndex;
  }
  edit(requests, raw = true) {
    this.startIdsAfter(requests);
    const ids = EditUtils.solveIds(requests, this._nextId);
    this._nextId += ids.length;
    for (const request of requests) {
      this.requests.push(request);
      this._requestIndex.push(request);
    }
    const { model, items } = EditUtils.edit(this.data, this.requests, {
      raw,
      delta: true
    });
    this._visibilityHelper.clearHiddenForEdit();
    this._visibilityHelper.hideForEdit(this, items);
    return { deltaModelBuffer: model, ids };
  }
  reset() {
    this.requests = [];
    this._requestsForRedo = [];
    this._requestsGeneration++;
    this._requestIndex.rebuild(this.requests);
    this._nextId = this.getMaxLocalId();
  }
  save(raw = true) {
    const request = {
      type: EditRequestType.UPDATE_MAX_LOCAL_ID,
      localId: this._nextId
    };
    this.requests.push(request);
    this._requestIndex.push(request);
    const { model } = EditUtils.edit(this.data, this.requests, {
      raw,
      delta: false
    });
    return model;
  }
  undo() {
    if (this.requests.length === 0) {
      return;
    }
    const lastRequest = this.requests.pop();
    if (!lastRequest) {
      return;
    }
    this._requestIndex.pop(lastRequest);
    this._requestsForRedo.unshift(lastRequest);
    this._requestsGeneration++;
  }
  redo() {
    if (this._requestsForRedo.length === 0) {
      return;
    }
    const lastUndoneRequest = this._requestsForRedo.shift();
    if (!lastUndoneRequest) {
      return;
    }
    this.requests.push(lastUndoneRequest);
    this._requestIndex.push(lastUndoneRequest);
  }
  getRequests() {
    return {
      requests: this.requests,
      undoneRequests: this._requestsForRedo
    };
  }
  /**
   * The requests added since an earlier call, or all of them if the log changed otherwise.
   * @param from - The `count` the earlier call returned.
   * @param generation - The `generation` the earlier call returned.
   */
  getRequestsSince(from, generation) {
    const kept = generation === this._requestsGeneration && Number.isInteger(from) && from >= 0 && from <= this.requests.length;
    const start = kept ? from : 0;
    return {
      generation: this._requestsGeneration,
      from: start,
      count: this.requests.length,
      requests: this.requests.slice(start)
    };
  }
  setRequests(data) {
    if (data.requests) {
      this.requests = data.requests;
      this._requestIndex.rebuild(this.requests);
      this._requestsGeneration++;
      this.startIdsAfter(this.requests);
    }
    if (data.undoneRequests) {
      this._requestsForRedo = data.undoneRequests;
      this.startIdsAfter(this._requestsForRedo);
    }
  }
  startIdsAfter(requests) {
    for (const request of requests) {
      const localId = request.localId;
      if (Number.isInteger(localId)) {
        this._nextId = Math.max(this._nextId, localId + 1);
      }
    }
  }
  selectRequest(index) {
    const allRequests = [];
    for (const request of this.requests) {
      allRequests.push(request);
    }
    for (const request of this._requestsForRedo) {
      allRequests.push(request);
    }
    this.requests = [];
    this._requestsForRedo = [];
    this._requestsGeneration++;
    for (let i = 0; i < allRequests.length; i++) {
      if (i <= index) {
        this.requests.push(allRequests[i]);
      } else {
        this._requestsForRedo.push(allRequests[i]);
      }
    }
    this._requestIndex.rebuild(this.requests);
  }
  getMaterialsIds() {
    const ids = EditUtils.getMaterialsIds(this.data);
    return EditUtils.applyChangesToIds(this.requests, ids, "MATERIAL", true);
  }
  getMaterials(ids) {
    const found = EditUtils.getMaterials(this.data, ids);
    EditUtils.applyChangesToRawData(this.requests, found, "MATERIAL");
    return found;
  }
  getRepresentationsIds() {
    const ids = EditUtils.getRepresentationsIds(this.data);
    return EditUtils.applyChangesToIds(
      this.requests,
      ids,
      "REPRESENTATION",
      true
    );
  }
  getRepresentations(ids) {
    const found = EditUtils.getRepresentations(this.data, ids);
    EditUtils.applyChangesToRawData(this.requests, found, "REPRESENTATION");
    return found;
  }
  getLocalTransformsIds() {
    const ids = EditUtils.getLocalTransformsIds(this.data);
    return EditUtils.applyChangesToIds(
      this.requests,
      ids,
      "LOCAL_TRANSFORM",
      true
    );
  }
  getLocalTransforms(ids) {
    const found = EditUtils.getLocalTransforms(this.data, ids);
    EditUtils.applyChangesToRawData(this.requests, found, "LOCAL_TRANSFORM");
    return found;
  }
  getGlobalTransformsIds() {
    const ids = EditUtils.getGlobalTransformsIds(this.data);
    return EditUtils.applyChangesToIds(
      this.requests,
      ids,
      "GLOBAL_TRANSFORM",
      true
    );
  }
  getGlobalTransforms(ids) {
    const found = EditUtils.getGlobalTransforms(this.data, ids);
    EditUtils.applyChangesToRawData(this.requests, found, "GLOBAL_TRANSFORM");
    return found;
  }
  getSamplesIds() {
    const ids = EditUtils.getSamplesIds(this.data);
    return EditUtils.applyChangesToIds(this.requests, ids, "SAMPLE", true);
  }
  getSamples(ids) {
    const result = EditUtils.getSamples(this.data, ids);
    EditUtils.applyChangesToRawData(this.requests, result, "SAMPLE");
    return result;
  }
  getItemsIds() {
    const ids = EditUtils.getItemsIds(this.data);
    return EditUtils.applyChangesToIds(this.requests, ids, "ITEM", true);
  }
  getItems(ids) {
    const itemIds = this.properties.getItemIdsFromLocalIds(ids);
    const found = EditUtils.getItems(this.data, itemIds);
    const filter = ids ? new Set(ids) : void 0;
    EditUtils.applyChangesToRawData(this.requests, found, "ITEM", filter);
    return found;
  }
  getRelations(ids) {
    const found = this.properties.getRawRelations(ids);
    EditUtils.applyChangesToRawData(this.requests, found, "RELATION");
    return found;
  }
  getGlobalTranformsIdsOfItems(ids) {
    return EditUtils.getGlobalTranformsIdsOfItems(this.data, ids);
  }
  getElementsData(ids) {
    const filtered = new Set(ids);
    EditUtils.applyChangesToIds(this.requests, filtered, "ITEM", false);
    return EditUtils.getElementsData(this, filtered);
  }
  /**
   * Fast snap-only data fetch keyed by **itemId** (the FlatBuffer's
   * `sample.item()` index). See `EditUtils.getItemSnapData` for the
   * rationale; in short, it uses `boxes.sampleOf(itemId)` for an O(1)
   * sample lookup instead of walking the full sample table.
   */
  getItemSnapData(itemId) {
    return EditUtils.getItemSnapData(this, itemId);
  }
  setLodMode(lodMode) {
    this.tiles.setLodMode(lodMode);
  }
  setupBVH() {
    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;
  }
  setupProperties() {
    return new VirtualPropertiesController(
      this,
      this.boxes,
      this._config.properties
    );
  }
  setupRaycaster() {
    return new RaycastController(
      this.data,
      this.boxes,
      this.tiles,
      this.itemConfig
    );
  }
  setupMaterials(modelId) {
    return new VirtualMaterialController(modelId, this._onTransferMaterial);
  }
  setupTiles() {
    const materials = this.materials.update(this.data);
    return new VirtualTilesController({
      modelId: this._modelId,
      connection: this._connection,
      multithreading: this._config.multithreading,
      model: this.data,
      boxes: this.boxes,
      items: this.itemConfig,
      materials
    });
  }
  setupModel(data) {
    const uintArray = new Uint8Array(data);
    const byteBuffer = new ByteBuffer(uintArray);
    return Model.getRootAsModel(byteBuffer);
  }
  _onTransferMaterial = (data, trans) => {
    if (!this._connection) return void 0;
    return this._connection.fetch(data, trans);
  };
  setupItemsConfig() {
    const meshes = this.data.meshes();
    const itemsCount = meshes ? meshes.meshesItemsLength() : 0;
    return new ItemConfigController(itemsCount);
  }
}
export {
  VirtualFragmentsModel
};
//# sourceMappingURL=virtual-fragments-model.mjs.map
