import * as THREE from "three";
import { ObjectClass, LodMode, TileRequestClass, CurrentLod, limitOf2Bytes } from "../../model/model-types.mjs";
import { ItemConfigController } from "./item-config-controller.mjs";
import { MeshConnection } from "../../multithreading/mesh-connection.mjs";
import { threadSeq } from "../../multithreading/thread-seq.mjs";
import { RaycastController } from "./raycast-controller.mjs";
import { VirtualMemoryController } from "./virtual-memory-controller.mjs";
import { Representation } from "../../../../Schema/representation.mjs";
import { Sample } from "../../../../Schema/sample.mjs";
import { VirtualShellManager } from "../virtual-meshes/virtual-shell-manager.mjs";
import { VirtualCircleExtrusionManager } from "../virtual-meshes/virtual-circle-extrusion-manager.mjs";
import { BoxUtils } from "../../utils/geometry/box-utils.mjs";
import { MultiBufferData } from "../../utils/misc/multi-buffer-data.mjs";
import { LodClass, normalizationValue } from "../virtual-meshes/types.mjs";
import { CRC } from "../../utils/misc/crc.mjs";
import { TransformHelper } from "../../utils/geometry/transform-helper.mjs";
import { MiscHelper } from "../../utils/misc/misc-helper.mjs";
import { CameraUtils } from "../../utils/geometry/camera-utils.mjs";
class VirtualTilesController {
  meshes;
  tilesUpdated = false;
  static _graphicMemoryConsumed = 0;
  _sampleAmount;
  _tileDimension;
  _tileBySample;
  _lodBySample;
  _virtualMeshes = /* @__PURE__ */ new Map();
  _meshConnection;
  _samples;
  _tileIdGenerator = new CRC();
  _tiles = /* @__PURE__ */ new Map();
  _tilesChanged = /* @__PURE__ */ new Set();
  _sizeByTile = /* @__PURE__ */ new Map();
  _samplesDimensions;
  _sampleLodClass;
  _sampleLodState;
  _sampleLodSize;
  _boxes;
  _items;
  _materials;
  _modelId;
  _model;
  _lastView = {
    rotation: new THREE.Vector3(),
    location: new THREE.Vector3()
  };
  _params = {
    updateTime: 16,
    updateSamples: 64,
    updateviewOrientation: 8 * Math.PI / 180,
    updateViewPosition: 256,
    smallTileSize: 0.32,
    mediumTileSize: 4,
    smallObjectSize: 2,
    smallScreenSize: 2,
    mediumScreenSize: 4,
    largeScreenSize: 16,
    tempTileDataSize: 6,
    tileIdIncrement: 1,
    tileSizeMultiplier: 10,
    minTileDimension: 32,
    tileDimensionFactor: 8
  };
  _temp = {
    sample: new Sample(),
    representation: new Representation(),
    vector: new THREE.Vector3(),
    matrix: new THREE.Matrix4(),
    transform: new THREE.Matrix4(),
    boundingBox: new THREE.Box3(),
    sampleGeometry: {},
    box: new THREE.Box3(),
    raycastPoints: [],
    tileData: {
      positionCount: this._params.tempTileDataSize,
      objectClass: ObjectClass.LINE,
      positionBuffer: new Float32Array(this._params.tempTileDataSize)
    },
    tileCenter: new THREE.Vector3(),
    tile: {
      objectClass: ObjectClass.LINE,
      positionCount: 6
    },
    viewDimension: 0,
    pastFieldOfview: 0
  };
  _currentSample = 0;
  /**
   * Whether the sweep may rewind to the largest samples on the next big
   * view change. Cleared by a rewind, set again when the cursor wraps, so
   * the sweep rewinds at most once per full lap (see {@link rewindSweep}).
   */
  _rewindArmed = true;
  _virtualPlanes = [];
  _changedSamples = 0;
  _virtualView;
  /**
   * Per-sample frustum verdict from the spatial hierarchy, refreshed on
   * every real view change: 1 = the sample's box is provably outside
   * the frustum/clipping planes (skip all per-sample plane math in
   * {@link fetchLodLevel}), 0 = candidate (run the exact per-sample
   * test as before, so the final classification is unchanged). All
   * zeroes when no view or lookup exists — the pass then behaves
   * exactly like the flat version.
   */
  _outsideMask;
  _lodMode = LodMode.DEFAULT;
  constructor(data) {
    this._modelId = data.modelId;
    this._model = data.model;
    this._boxes = data.boxes;
    this._items = data.items;
    this._materials = data.materials;
    this._meshConnection = new MeshConnection(
      data.modelId,
      data.connection,
      data.multithreading
    );
    this.meshes = data.model.meshes();
    this._sampleAmount = this.meshes.samplesLength();
    this._samples = new ItemConfigController(this._sampleAmount);
    this._samplesDimensions = new Int32Array(this._sampleAmount);
    this._sampleLodClass = new Uint8Array(this._sampleAmount);
    this._sampleLodState = new Uint8Array(this._sampleAmount);
    this._sampleLodSize = new Float32Array(this._sampleAmount);
    this._outsideMask = new Uint8Array(this._sampleAmount);
    this._tileDimension = this.computeTileSize();
    this._tileBySample = new Array(this._sampleAmount);
    this._lodBySample = new Array(this._sampleAmount);
    this.init();
  }
  restart() {
    this.resetUpdateProcess();
    this._meshConnection.clean();
  }
  fetchSample(id, lod) {
    this.fetchSampleAndRepresentation(id);
    const mesh = this.fetchCurrentMesh();
    const sample = this.sampleTemplate(id);
    sample.geometries = this.sampleGeoms(sample, lod, mesh);
    return sample;
  }
  fetchGeometry(id) {
    this.meshes.representations(id, this._temp.representation);
    const mesh = this.fetchCurrentMesh();
    return mesh.fetchMeshes(id, true);
  }
  dispose() {
    this._meshConnection.dispose();
    for (const [, mesh] of this._virtualMeshes) {
      mesh.dispose();
    }
    for (const [, tile] of this._tiles) {
      if (!tile.notVirtual) continue;
      tile.notVirtual = false;
      VirtualTilesController._graphicMemoryConsumed -= tile.usedMemory;
    }
  }
  async generate(onProgress, throwIfAborted) {
    for (const [, mesh] of this._virtualMeshes) {
      mesh.setupTemplates();
    }
    const step = Math.max(1, Math.floor(this._sampleAmount / 20));
    for (let i = 0; i < this._sampleAmount; i++) {
      this.generateSampleInTiles(this._samplesDimensions[i]);
      if (i % step === 0) {
        onProgress?.(i / this._sampleAmount);
        await new Promise((resolve) => setTimeout(resolve, 0));
        throwIfAborted?.();
      }
    }
    this.setupTileVisibilityAndHighlight();
  }
  setupView(view) {
    const previous = this._virtualView;
    this._virtualView = view;
    VirtualMemoryController.setCapacity(view.meshThreshold);
    if (previous && this.viewEquals(previous, view)) {
      this.setupViewPlanes();
      if (this.tilesUpdated) {
        this.emitFinish();
      }
      return;
    }
    this.restart();
    this.updateOrientationIfNeeded();
    this.updatePositionIfNeeded();
    this.setupViewPlanes();
    this.updateOutsideMask();
  }
  /**
   * Rebuilds {@link _outsideMask} from the spatial hierarchy for the
   * current view. One hierarchy walk per view change replaces the
   * per-sample plane tests for everything that is provably outside —
   * with a zoomed-in camera that is typically most of the model. Falls
   * back to all-candidates (no skipping) when the model has no lookup
   * (empty model) or no view yet.
   */
  updateOutsideMask() {
    const lookup = this._boxes.lookup;
    const frustum = this._virtualView?.cameraFrustum;
    if (!lookup || !frustum) {
      this._outsideMask.fill(0);
      return;
    }
    const clipping = this._virtualView.clippingPlanes ?? [];
    lookup.fillOutsideFrustumMask(clipping, frustum, this._outsideMask);
  }
  updateVirtualMeshes(itemIds) {
    if (!itemIds || !this._virtualView) {
      return;
    }
    for (const itemId of itemIds) {
      this.updateItem(itemId);
    }
    this.restart();
  }
  getSampleTransform(id) {
    this.fetchSampleAndRepresentation(id);
    const sample = this.sampleTemplate(id);
    return sample.transform;
  }
  /**
   * For every loaded tile that contains at least one of the given items,
   * returns the index-buffer chunks those items occupy in the tile.
   *
   * Lets a renderer clone the tile mesh sharing its `geometry.attributes`
   * and `index`, then add `geometry.groups` for just the returned chunks
   * to draw only the outlined slices. No highlight bookkeeping, no
   * per-item slot allocation, no material array growth.
   *
   * Samples are stored in the tile in insertion order with locations
   * `0..N-1`; `indexLocation[i]` is the start of sample `i` in the tile's
   * index buffer, so a contiguous run of in-set samples maps to a single
   * `(position, size)` chunk.
   *
   * @param itemIds - Internal item ids to look up. Public callers go
   *   through {@link VirtualFragmentsModel.getItemDrawChunks}, which
   *   accepts localIds and converts.
   * @returns One entry per affected tile. `position[i]` and `size[i]`
   *   are parallel arrays giving start index and index count.
   */
  getDrawChunksForItems(itemIds) {
    const result = [];
    if (itemIds.size === 0) return result;
    for (const [tileId, tile] of this._tiles) {
      if (!tile.notVirtual) continue;
      const totalIndices = tile.indexCount ?? 0;
      if (!totalIndices) continue;
      const positions = [];
      const sizes = [];
      let runStart = -1;
      let location = 0;
      for (const [sample] of tile.sampleLocation) {
        const inSet = itemIds.has(this.itemId(sample));
        if (inSet) {
          if (runStart < 0) runStart = location;
        } else if (runStart >= 0) {
          const startIdx = tile.indexLocation[runStart];
          const endIdx = tile.indexLocation[location];
          positions.push(startIdx);
          sizes.push(endIdx - startIdx);
          runStart = -1;
        }
        location++;
      }
      if (runStart >= 0) {
        const startIdx = tile.indexLocation[runStart];
        positions.push(startIdx);
        sizes.push(totalIndices - startIdx);
      }
      if (positions.length === 0) continue;
      result.push({
        tileId,
        position: new Uint32Array(positions),
        size: new Uint32Array(sizes)
      });
    }
    return result;
  }
  async update(time) {
    this.updateTiles(time);
    for (const tileId of this._tilesChanged) {
      const tile = this._tiles.get(tileId);
      this._meshConnection.process({
        tileRequestClass: TileRequestClass.UPDATE,
        modelId: this._modelId,
        tileId,
        objectClass: tile.objectClass,
        material: tile.materialId,
        tileData: this.getTileData(tile),
        currentLod: tile.lod
      });
    }
    this._tilesChanged.clear();
    this.notifyUpdateFinished();
  }
  raycast(representation, ray, frustum, snap) {
    this._temp.raycastPoints = [];
    const rClass = representation.representationClass();
    const mesh = this._virtualMeshes.get(rClass);
    this.manageRaycast(mesh, representation, ray, frustum, snap);
    return this._temp.raycastPoints;
  }
  setLodMode(lodMode) {
    this._lodMode = lodMode;
    this.restart();
  }
  init() {
    const shells = new VirtualShellManager(this._modelId, this.meshes);
    const shellsRepresentation = shells.getRepresentation();
    this._virtualMeshes.set(shellsRepresentation, shells);
    const ces = new VirtualCircleExtrusionManager(this._modelId, this.meshes);
    const cesRepresentation = ces.getRepresentation();
    this._virtualMeshes.set(cesRepresentation, ces);
    this.processSamplesDimension();
    this.fetchSampleLodSize();
  }
  initSampleLod(id) {
    this.fetchSampleAndRepresentation(id);
    const mesh = this.fetchCurrentMesh();
    this._sampleLodClass[id] = mesh.getLodClass();
    this._sampleLodState[id] = CurrentLod.INVISIBLE;
  }
  fetchSampleAndRepresentation(id) {
    this.meshes.samples(id, this._temp.sample);
    this.meshes.representations(
      this._temp.sample.representation(),
      this._temp.representation
    );
  }
  fetchCurrentMesh() {
    const rClass = this._temp.representation.representationClass();
    return this._virtualMeshes.get(rClass);
  }
  fetchCurrentMaterial() {
    const materialId = this._temp.sample.material();
    return this._materials[materialId];
  }
  fetchSampleLodSize() {
    for (let i = 0; i < this._sampleAmount; i++) {
      this.initSampleLod(i);
      TransformHelper.getBox(this._temp.representation, this._temp.box);
      this._sampleLodSize[i] = BoxUtils.getWidth(this._temp.box);
    }
  }
  setupTileVisibilityAndHighlight() {
    for (const [, tile] of this._tiles) {
      tile.visibilities = new MultiBufferData(tile.size, false);
      tile.highlights = new MultiBufferData(tile.size, 0);
    }
  }
  addLodToTile(mesh, id, material) {
    if (mesh.getLodClass() === LodClass.AABB) {
      this.addBoxLodToTile(id, material);
      return;
    }
    if (mesh.getLodClass() === LodClass.CUSTOM) {
      this.addCustomLodToTile(mesh, id, material);
    }
  }
  addBoxLodToTile(id, material) {
    this._lodBySample[id] = this.lodTileAppendSample(id, material);
  }
  notifyUpdateFinished() {
    const noficationNotSentYet = !this.tilesUpdated;
    const samplesUpdated = this._changedSamples >= this._sampleAmount;
    const updateFinished = samplesUpdated && noficationNotSentYet;
    if (!updateFinished) {
      return;
    }
    this.emitFinish();
    this.tilesUpdated = true;
  }
  emitFinish() {
    this._meshConnection.process({
      tileRequestClass: TileRequestClass.FINISH,
      modelId: this._modelId,
      // Stamp with the highest seq this worker has seen on incoming
      // RPCs. Because RPC handlers serialize with the update tick on
      // the worker (single-threaded JS), any RPC that finished before
      // this tick has had its state changes processed during it — so
      // any tile updates emitted in this batch reflect those RPCs'
      // effects. Main uses the stamp to resolve `forceUpdateFinish`
      // waiters precisely, no buffer / poll required.
      seq: threadSeq.lastSeen
    });
  }
  /**
   * Structural equality of two worker-side views, covering every field
   * the culling/LOD pass reads. `graphicThreshold` is deliberately
   * ignored — it only budgets the invisible-tile cache, so a change in
   * it must not trigger a full re-cull (the new value still takes
   * effect because the caller stores the incoming view first).
   */
  viewEquals(a, b) {
    if (a.fov !== b.fov || a.orthogonalDimension !== b.orthogonalDimension || a.viewSize !== b.viewSize || a.graphicQuality !== b.graphicQuality) {
      return false;
    }
    if (!this.vectorEquals(a.cameraPosition, b.cameraPosition)) {
      return false;
    }
    const aPlanes = a.cameraFrustum.planes;
    const bPlanes = b.cameraFrustum.planes;
    for (let i = 0; i < aPlanes.length; i++) {
      if (!this.planeEquals(aPlanes[i], bPlanes[i])) {
        return false;
      }
    }
    const aClipping = a.clippingPlanes || [];
    const bClipping = b.clippingPlanes || [];
    if (aClipping.length !== bClipping.length) {
      return false;
    }
    for (let i = 0; i < aClipping.length; i++) {
      if (!this.planeEquals(aClipping[i], bClipping[i])) {
        return false;
      }
    }
    return true;
  }
  planeEquals(a, b) {
    return a.constant === b.constant && this.vectorEquals(a.normal, b.normal);
  }
  vectorEquals(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }
  updatePositionIfNeeded() {
    const positionThreshold = this._params.updateViewPosition;
    const pos = this._virtualView.cameraPosition;
    const positionChange = pos.distanceToSquared(this._lastView.location);
    const positionNeedsUpdate = positionChange > positionThreshold;
    if (positionNeedsUpdate && this.rewindSweep()) {
      this._lastView.location.copy(pos);
    }
  }
  /**
   * Restarts the sweep at the largest samples, so a big view change
   * repaints what dominates the screen first. At most once per full lap:
   * under continuous motion (#300) every refresh crossed a threshold, the
   * sweep kept going back to the start and the smaller samples were never
   * revisited until the camera stopped. Returns whether the cursor is now
   * at the start of the sweep.
   */
  rewindSweep() {
    if (!this._rewindArmed && this._currentSample !== 0) {
      return false;
    }
    this._currentSample = 0;
    this._rewindArmed = false;
    return true;
  }
  updateCurrentSample() {
    this._currentSample++;
    if (this._currentSample >= this._sampleAmount) {
      this._currentSample = 0;
      this._rewindArmed = true;
    }
    this._changedSamples++;
  }
  processSamplesDimension() {
    for (let i = 0; i < this._sampleAmount; i++) {
      this._samplesDimensions[i] = i;
    }
    this._samplesDimensions.sort((a, b) => {
      const bDimension = this._boxes.dimensionOf(b);
      const aDimension = this._boxes.dimensionOf(a);
      return bDimension - aDimension;
    });
  }
  /**
   * Defensive only. A camera-less main thread sends a model-containing frustum
   * rather than omitting one, so this should always be true in practice —
   * but the field is untyped across the worker boundary, and dereferencing
   * it unguarded is what turns a missing frustum into a crash on every
   * frame instead of a degraded view.
   */
  get hasCameraFrustum() {
    return !!this._virtualView.cameraFrustum;
  }
  setupViewPlanes() {
    this._virtualPlanes = [];
    if (this.hasCameraFrustum) {
      for (const plane of this._virtualView.cameraFrustum.planes) {
        this._virtualPlanes.push(plane);
      }
    }
    if (this._virtualView.clippingPlanes) {
      for (const plane of this._virtualView.clippingPlanes) {
        this._virtualPlanes.push(plane);
      }
    }
  }
  updateOrientationIfNeeded() {
    const orientation = this.getCurrentViewOrientation();
    if (!orientation) return;
    const orientationThreshold = this._params.updateviewOrientation;
    const orientationChange = orientation.angleTo(this._lastView.rotation);
    const orientationNeedsUpdate = orientationChange > orientationThreshold;
    if (orientationNeedsUpdate && this.rewindSweep()) {
      this._lastView.rotation.copy(orientation);
    }
  }
  getCurrentViewOrientation() {
    if (!this.hasCameraFrustum) {
      return void 0;
    }
    return this._virtualView.cameraFrustum.planes[4].normal;
  }
  resetUpdateProcess() {
    this._changedSamples = 0;
    this.tilesUpdated = false;
  }
  manageRaycast(mesh, repr, ray, frustum, snap) {
    const found = RaycastController.cast(mesh, repr, ray, frustum, snap);
    if (found) {
      for (const point of found) {
        point.representationClass = mesh.getObjectClass();
        this._temp.raycastPoints.push(point);
      }
    }
  }
  setTileShellBuffer(tile) {
    if (tile.usedMemory === void 0 || tile.objectClass !== ObjectClass.SHELL) {
      return;
    }
    tile.ids = new Uint8Array(tile.positionCount / 3 * 4);
    tile.usedMemory += tile.ids.byteLength;
  }
  getTileWhenSamplePut(tileId, tileData, material) {
    let tile = this._tiles.get(tileId);
    if (tile === void 0) {
      const lod = tileData.lod || CurrentLod.GEOMETRY;
      tile = this.newTile(tileData.objectClass, material, lod);
      this._tiles.set(tileId, tile);
    }
    return tile;
  }
  getPerspTrueDim(fov, distance) {
    const radFactor = Math.PI / 180;
    const tan = Math.tan(fov * 0.5 * radFactor);
    return distance * tan;
  }
  getTileHighlight(tile, locations) {
    let highlightData = void 0;
    let highlightIds = void 0;
    const highlights = tile.highlights;
    if (!highlights) {
      return { highlightData: void 0, highlightIds: void 0 };
    }
    const highlightSize = highlights.size((id) => id !== 0);
    if (highlightSize > 0) {
      highlightIds = new Uint16Array(highlightSize);
      const f = (id) => id !== 0;
      const c = (id, data) => highlightIds[id] = data;
      highlightData = MultiBufferData.get(highlights, locations, f, c);
    }
    return { highlightData, highlightIds };
  }
  setupTileSampleAttributes(tile, location, geometry, sample) {
    const resultPosition = tile.vertexLocation[location] * 3;
    for (let i = 0; i < geometry.positionBuffer.length; i += 3) {
      this._temp.vector.fromArray(geometry.positionBuffer, i);
      this._temp.vector.applyMatrix4(this._temp.matrix);
      this._temp.vector.toArray(tile.positionBuffer, resultPosition + i);
    }
    if (tile.normalBuffer) {
      const resultPosition2 = tile.vertexLocation[location] * 3;
      for (let i = 0; i < geometry.normalBuffer.length; i += 3) {
        this._temp.vector.fromArray(geometry.normalBuffer, i);
        this._temp.vector.transformDirection(this._temp.matrix);
        this._temp.vector.multiplyScalar(normalizationValue);
        this._temp.vector.toArray(tile.normalBuffer, resultPosition2 + i);
      }
    }
    if (tile.indexBuffer) {
      const indicesPosition = tile.indexLocation[location];
      const position = tile.vertexLocation[location];
      for (let i = 0; i < geometry.indexCount; i++) {
        const result = geometry.indexBuffer[i] + position;
        tile.indexBuffer[i + indicesPosition] = result;
      }
    }
    if (tile.faceIdBuffer && geometry.faceIdBuffer) {
      const sampleOffset = sample.sample * 100;
      const start = tile.vertexLocation[location];
      const end = start + geometry.positionCount / 3;
      for (let i = start; i < end; i++) {
        tile.faceIdBuffer[i] = geometry.faceIdBuffer[i - start] + sampleOffset;
      }
    }
    if (geometry.objectClass === ObjectClass.SHELL) {
      const start = tile.vertexLocation[location];
      const end = start + geometry.positionCount / 3;
      const itemId = this.itemId(sample.sample);
      const encoded = itemId + 1 >>> 0;
      const b0 = Math.floor(encoded / 16777216) & 255;
      const b1 = Math.floor(encoded / 65536) & 255;
      const b2 = Math.floor(encoded / 256) & 255;
      const b3 = encoded & 255;
      const buf = tile.ids;
      for (let i = start; i < end; i++) {
        const o = i * 4;
        buf[o] = b0;
        buf[o + 1] = b1;
        buf[o + 2] = b2;
        buf[o + 3] = b3;
      }
    }
  }
  getTileVisibility(tile, locations) {
    if (!tile.visibilities) {
      throw new Error("Fragments: Malformed tile!");
    }
    if (tile.visibilities.fullOf(false)) {
      return void 0;
    }
    const filter = (data) => data;
    return MultiBufferData.get(tile.visibilities, locations, filter);
  }
  memoryOverflow() {
    const current = VirtualTilesController._graphicMemoryConsumed;
    const available = this._virtualView.graphicThreshold;
    return current > available;
  }
  updateMesh(sample) {
    let current = this.fetchLodLevel(sample);
    const past = this._sampleLodState[sample];
    current = this.hideHighlightedLods(current, sample);
    if (current === past) {
      this.updateSampleIfSeen(current, sample);
      return;
    }
    this.updateVisible(past, current, sample);
  }
  tileLoadSample(tile, sample, geomIndex) {
    const location = tile.sampleLocation.get(sample.sample);
    const geometry = this.getSampleGeometries(sample, geomIndex);
    this.setupTileLocation(tile, geometry, sample);
    this.fetchSampleTransform(tile, sample);
    this.setupTileSampleAttributes(tile, location, geometry, sample);
  }
  updateSampleIfSeen(current, sample) {
    if (current !== CurrentLod.INVISIBLE) {
      this.updateSample(sample, current);
    }
  }
  hideHighlightedLods(current, _sample) {
    return current;
  }
  updateVisible(past, current, sample) {
    if (past !== CurrentLod.INVISIBLE) {
      this.makeSampleInvisible(sample, past);
    }
    const isSeen = current !== CurrentLod.INVISIBLE;
    if (isSeen) {
      this.updateSample(sample, current);
    }
    this._samples.setVisible(sample, isSeen);
    this._sampleLodState[sample] = current;
  }
  makeInvisibleFromTile(tileId, sample) {
    const tile = this._tiles.get(tileId);
    this.updateTileData(tile, sample, false, 0);
    this.deleteTileIfNeeded(tile, tileId);
  }
  updateSample(id, lod) {
    const itemId = this.itemId(id);
    const visible = this._items.visible(itemId);
    const highlight = this._items.getHighlight(itemId);
    const changed = this.hasChanged(id, lod, visible, highlight);
    if (changed) {
      this.setSample(id, visible, highlight, lod);
    }
  }
  hasHighlightChanged(id, highlight) {
    const currentHighlight = this._samples.getHighlight(id);
    return highlight !== currentHighlight;
  }
  hasVisibleChanged(id, visible) {
    const currentVisible = this._samples.visible(id);
    return visible !== currentVisible;
  }
  newTile(objectClass, material, lod) {
    const tile = {};
    tile.notVirtual = false;
    tile.materialId = material;
    tile.indexLocation = [];
    tile.box = new THREE.Box3();
    tile.objectClass = objectClass;
    tile.lod = lod;
    tile.normalCount = 0;
    tile.indexCount = 0;
    tile.vertexLocation = [];
    tile.size = 0;
    tile.geometriesLocation = [];
    tile.positionCount = 0;
    tile.sampleLocation = /* @__PURE__ */ new Map();
    tile.faceIdBuffer = new Uint32Array(0);
    return tile;
  }
  createLod(box) {
    const line = TransformHelper.boxSize(box);
    const position = this._temp.tileData.positionBuffer;
    if (!position) {
      throw new Error("Fragments: Malformed tiles!");
    }
    position[0] = line.start.x;
    position[1] = line.start.y;
    position[2] = line.start.z;
    position[3] = line.end.x;
    position[4] = line.end.y;
    position[5] = line.end.z;
    return this._temp.tileData;
  }
  sampleTemplate(id) {
    const sample = this._temp.sample;
    const representation = this._temp.representation;
    TransformHelper.get(sample, this.meshes, this._temp.transform);
    TransformHelper.getBox(representation, this._temp.boundingBox);
    this._temp.sampleGeometry.sample = id;
    const materialId = sample.material();
    this._temp.sampleGeometry.material = this._materials[materialId];
    this._temp.sampleGeometry.transform = this._temp.transform;
    this._temp.sampleGeometry.aabb = this._temp.boundingBox;
    delete this._temp.sampleGeometry.geometries;
    const reprIndex = this._temp.sample.representation();
    const reprId = this.meshes.representationIds(reprIndex);
    this._temp.sampleGeometry.representationId = reprId;
    return this._temp.sampleGeometry;
  }
  makeSampleInvisible(id, lod) {
    const tileIds = this.getTileIds(id, lod);
    if (!tileIds) {
      return;
    }
    const callback = (tileId) => this.makeInvisibleFromTile(tileId, id);
    MiscHelper.forEach(tileIds, callback);
  }
  setSample(id, vis, high, lod) {
    this._samples.setVisible(id, vis);
    this._samples.setHighlight(id, high);
    const tileIds = this.getTileIds(id, lod);
    if (tileIds === void 0) return;
    MiscHelper.forEach(tileIds, (tileId) => {
      this.updateTile(tileId, id, vis ? high : 0, vis && high === 0);
    });
  }
  getTileIds(sample, lod) {
    if (lod === CurrentLod.GEOMETRY) {
      return this._tileBySample[sample];
    }
    return this._lodBySample[sample];
  }
  addBasicTileData(a, sample, id) {
    a.sampleLocation.set(sample, a.size);
    a.size++;
    a.geometriesLocation.push(id);
    a.indexLocation.push(a.indexCount || 0);
    a.vertexLocation.push((a.positionCount || 0) / 3);
  }
  buildNewVirtualTile(tile, tileId) {
    this.constructTile(tile);
    this.loadTile(tileId, tile);
    tile.notVirtual = true;
    delete tile.indexBuffer;
    delete tile.positionBuffer;
    delete tile.normalBuffer;
    delete tile.faceIdBuffer;
    delete tile.ids;
  }
  deleteTileIfNeeded(tile, tileId) {
    const shouldDelete = this.getShouldDeleteTile(tile);
    if (shouldDelete) {
      this.deleteGeometry(tileId);
      tile.notVirtual = false;
      VirtualTilesController._graphicMemoryConsumed -= tile.usedMemory;
      return;
    }
    this._tilesChanged.add(tileId);
  }
  getShouldDeleteTile(tile) {
    if (!tile.visibilities || !tile.highlights) {
      throw new Error("Fragments: Malformed tile!");
    }
    const invisible = tile.visibilities.fullOf(false);
    const noHighlight = tile.highlights.fullOf(0);
    const memoryOverflow = this.memoryOverflow();
    return invisible && noHighlight && memoryOverflow;
  }
  checkTileMemoryOverflow(tileId, tileData) {
    const tile = this._tiles.get(tileId);
    const bufferSize = tile ? tile.positionCount : 0;
    const totalSize = bufferSize + tileData.positionCount;
    const memoryOverflow = totalSize > limitOf2Bytes;
    return memoryOverflow;
  }
  updateTileData(tile, sample, visible, highlight) {
    if (!tile.visibilities || !tile.highlights) {
      throw new Error("Fragments: Malformed tile!");
    }
    const id = tile.sampleLocation.get(sample);
    tile.visibilities.update(id, visible);
    tile.highlights.update(id, highlight);
  }
  getKeepUpdating(sampleId, time) {
    const maxTime = this._params.updateTime;
    const minSamples = this._params.updateSamples;
    const samplesLeft = sampleId < this._sampleAmount;
    const passedTime = performance.now() - time;
    const isFirstSamples = sampleId < minSamples;
    const timeLeft = passedTime < maxTime || isFirstSamples;
    const shouldKeepUpdating = samplesLeft && timeLeft;
    return shouldKeepUpdating;
  }
  computeTileSize() {
    const dimension = this._boxes.fullBox.getSize(this._temp.vector);
    const maxDimension = Math.max(dimension.x, dimension.y, dimension.z);
    const fraction = maxDimension / this._params.tileDimensionFactor;
    const maxIntFraction = Math.ceil(fraction);
    return Math.max(this._params.minTileDimension, maxIntFraction);
  }
  newTileId(sample, material, tileData) {
    this.logBufferOverflowIfNeeded(tileData);
    const lod = tileData.lod || CurrentLod.GEOMETRY;
    const code = this.generateTileCode(sample, material, tileData, lod);
    const tileSize = this._sizeByTile.get(code) || 1;
    let tileId = code + tileSize - 1;
    const memoryOverflow = this.checkTileMemoryOverflow(tileId, tileData);
    if (memoryOverflow) {
      tileId += this._params.tileIdIncrement;
      this._sizeByTile.set(code, tileSize + 1);
    }
    return tileId;
  }
  logBufferOverflowIfNeeded(tileData) {
    const geometrySize = tileData.positionCount / 3;
    if (geometrySize > limitOf2Bytes) {
      console.log("Fragments: Buffer overflow");
    }
  }
  fetchLodLevel(sample) {
    if (this._lodMode === LodMode.ALL_VISIBLE) {
      this.meshes.samples(sample, this._temp.sample);
      const itemId2 = this._temp.sample.item();
      const isSeen2 = this._items.visible(itemId2);
      if (!isSeen2) {
        return CurrentLod.INVISIBLE;
      }
      return CurrentLod.GEOMETRY;
    }
    if (this._outsideMask[sample]) {
      return CurrentLod.INVISIBLE;
    }
    const item = this._boxes.get(sample);
    const notClipped = CameraUtils.collides(item, this._virtualPlanes);
    if (!notClipped) {
      return CurrentLod.INVISIBLE;
    }
    this.meshes.samples(sample, this._temp.sample);
    const itemId = this._temp.sample.item();
    const isSeen = this._items.visible(itemId);
    if (!isSeen) {
      return CurrentLod.INVISIBLE;
    }
    const quality = this._virtualView.graphicQuality;
    const dimension = this._boxes.dimensionOf(sample);
    const offset = item.distanceToPoint(this._virtualView.cameraPosition);
    const screenDimension = this.screenSize(dimension, offset);
    const isSmall = dimension < this._params.smallObjectSize;
    const isLarge = !isSmall;
    const smallScreen = this._params.smallScreenSize * quality;
    const mediumScreen = this._params.mediumScreenSize * quality;
    const largeScreen = this._params.largeScreenSize * quality;
    const isSmallInScreen = screenDimension < smallScreen;
    const isMediumInScreen = screenDimension < mediumScreen;
    const isLargeInScreen = screenDimension < largeScreen;
    const smallAndFar = isSmall && isMediumInScreen;
    const largeAndVeryFar = isLarge && isSmallInScreen;
    const smallAndClose = isSmall && isLargeInScreen;
    const largeAndFar = isLarge && isMediumInScreen;
    if (smallAndFar || largeAndVeryFar) {
      return CurrentLod.INVISIBLE;
    }
    if (this._lodMode === LodMode.ALL_GEOMETRY) {
      return CurrentLod.GEOMETRY;
    }
    if (smallAndClose || largeAndFar) {
      return CurrentLod.WIRES;
    }
    const lodSize = this._sampleLodSize[sample];
    const screenSize = this.screenSize(lodSize, offset);
    const wireLimit = Math.max(mediumScreen, this._params.mediumScreenSize);
    const isWireLike = screenSize < wireLimit;
    if (isWireLike) {
      return CurrentLod.WIRES;
    }
    return CurrentLod.GEOMETRY;
  }
  generateTileCode(sample, material, tile, lod) {
    this._tileIdGenerator.reset();
    this.processTileDataId(tile, material, lod);
    const box = this.processTileSpatialId(sample, lod);
    this.processTileDimensionId(box);
    return this._tileIdGenerator.value;
  }
  processTileDataId(tile, material, lod) {
    this._tileIdGenerator.compute(
      tile.objectClass !== void 0 ? tile.objectClass : 0
    );
    this._tileIdGenerator.compute(material);
    this._tileIdGenerator.compute(lod);
  }
  deleteGeometry(tileId) {
    this._meshConnection.process({
      tileRequestClass: TileRequestClass.DELETE,
      modelId: this._modelId,
      tileId
    });
  }
  processTileSpatialId(sample, lod) {
    const x = this._temp.tileCenter.x;
    const y = this._temp.tileCenter.y;
    const z = this._temp.tileCenter.z;
    const box = this._boxes.get(sample);
    box.getCenter(this._temp.tileCenter);
    const tileDimension = this.getTileDimension(lod);
    const tx = x - x % tileDimension;
    const ty = y - y % tileDimension;
    const tz = z - z % tileDimension;
    this._tileIdGenerator.compute(tx);
    this._tileIdGenerator.compute(ty);
    this._tileIdGenerator.compute(tz);
    return box;
  }
  addCustomLodToTile(mesh, id, material) {
    const lods = this.meshData(mesh, false, CurrentLod.WIRES);
    this._sampleLodSize[id] = lods.lodThickness || 0;
    this._lodBySample[id] = this.putSampleInTiles(id, material, lods);
  }
  getTileLocations(tile) {
    if (tile.indexCount) {
      return tile.indexLocation;
    }
    return tile.vertexLocation;
  }
  getTileDimension(lod) {
    let tileDimension = this._tileDimension;
    if (lod === CurrentLod.GEOMETRY) {
      tileDimension *= this._params.tileSizeMultiplier;
    }
    return tileDimension;
  }
  processTileDimensionId(box) {
    const sizeCategory = this.getTileDimensionClass(box);
    this._tileIdGenerator.compute(sizeCategory);
  }
  tileAppend(a, b, sample, id) {
    this.addBasicTileData(a, sample, id);
    this.tileAppendAttribute(a, b, "indexCount", false);
    this.tileAppendAttribute(a, b, "positionCount", false);
    this.tileAppendAttribute(a, b, "normalCount", false);
    this.tileAppendAttribute(a, b, "materialId", true);
  }
  putSampleInTiles(sample, material, tiles) {
    let tileIds = void 0;
    const onSamplePut = (tileData, id) => {
      const tileId = this.newTileId(sample, material, tileData);
      tileIds = this.getTileIdsWhenSamplePut(tileIds, tileId);
      const tile = this.getTileWhenSamplePut(tileId, tileData, material);
      this.tileAppend(tile, tileData, sample, id);
    };
    MiscHelper.forEach(tiles, onSamplePut);
    return tileIds;
  }
  hasLodChanged(id, lod) {
    const currentLod = this._sampleLodState[id];
    return lod !== currentLod;
  }
  getTileIdsWhenSamplePut(tileIds, tileId) {
    if (tileIds === void 0) {
      tileIds = tileId;
    } else if (typeof tileIds === "number") {
      if (tileIds !== tileId) tileIds = [tileIds, tileId];
    } else if (!tileIds.includes(tileId)) {
      tileIds.push(tileId);
    }
    return tileIds;
  }
  updateTile(tileId, sample, highlight, visible) {
    const tile = this._tiles.get(tileId);
    this.updateTileData(tile, sample, visible, highlight);
    if (tile.notVirtual) {
      this._tilesChanged.add(tileId);
      return;
    }
    this.buildNewVirtualTile(tile, tileId);
  }
  getLodTileWhenPutSample(tileId, material) {
    let tile = this._tiles.get(tileId);
    if (!tile) {
      const objectClass = this._temp.tile.objectClass;
      tile = this.newTile(objectClass, material, CurrentLod.WIRES);
      this._tiles.set(tileId, tile);
    }
    return tile;
  }
  lodTileAppendSample(sample, material) {
    const wires = CurrentLod.WIRES;
    const tempTile = this._temp.tile;
    const tileId = this.generateTileCode(sample, material, tempTile, wires);
    const tile = this.getLodTileWhenPutSample(tileId, material);
    this.tileAppend(tile, tempTile, sample, 0);
    return tileId;
  }
  addSampleToTile(mesh, id, material) {
    const meshes = this.meshData(mesh, false, CurrentLod.GEOMETRY);
    this._tileBySample[id] = this.putSampleInTiles(id, material, meshes);
  }
  setTileBuffer(tile, key, unsigned) {
    if (tile.usedMemory === void 0) {
      return;
    }
    const count = tile[`${key}Count`];
    if (count > 0) {
      const buffer = unsigned ? new Uint16Array(count) : new Int16Array(count);
      tile[`${key}Buffer`] = buffer;
      tile.usedMemory += buffer.byteLength;
    }
  }
  updateTiles(time) {
    const needsUpdate = this._changedSamples < this._sampleAmount;
    const viewAvailable = this._virtualView !== void 0;
    if (!viewAvailable || !needsUpdate) {
      return;
    }
    let keepUpdating = true;
    let updatingSampleId = 0;
    while (keepUpdating) {
      const meshId = this._samplesDimensions[this._currentSample];
      this.updateMesh(meshId);
      this.updateCurrentSample();
      updatingSampleId++;
      keepUpdating = this.getKeepUpdating(updatingSampleId, time);
    }
  }
  sampleGeoms(sample, lod, mesh) {
    if (mesh.getLodClass() === LodClass.AABB && lod === CurrentLod.WIRES) {
      return this.createLod(sample.aabb);
    }
    return this.meshData(mesh, true, lod);
  }
  generateSampleInTiles(id) {
    this.fetchSampleAndRepresentation(id);
    const material = this.fetchCurrentMaterial();
    const mesh = this.fetchCurrentMesh();
    this.addSampleToTile(mesh, id, material);
    this.addLodToTile(mesh, id, material);
  }
  buildSampleInTile(tile, position, sample, isStart, id) {
    const found = tile.geometriesLocation[position];
    this.tileLoadSample(tile, sample, found);
    if (isStart) {
      const box = this._boxes.get(id);
      this._temp.vector.copy(tile.location);
      this._temp.vector.negate();
      box.translate(this._temp.vector);
      tile.box.union(box);
    }
  }
  getSampleGeometries(sample, geomIndex) {
    if (Array.isArray(sample.geometries)) {
      return sample.geometries[geomIndex];
    }
    return sample.geometries;
  }
  constructTile(tile) {
    if (tile.positionBuffer === void 0) {
      tile.positionBuffer = new Float32Array(tile.positionCount);
      tile.usedMemory = tile.positionBuffer.byteLength;
      this.setTileBuffer(tile, "index", true);
      this.setTileBuffer(tile, "normal", false);
      this.setTileShellBuffer(tile);
      tile.faceIdBuffer = new Uint32Array(tile.positionCount / 3);
      tile.usedMemory += tile.faceIdBuffer.byteLength;
    }
    const isStart = !tile.location;
    for (const [id, position] of tile.sampleLocation) {
      const sample = this.fetchSample(id, tile.lod);
      if (sample && sample.geometries) {
        this.buildSampleInTile(tile, position, sample, isStart, id);
      }
    }
  }
  fetchSampleTransform(tile, sample) {
    this._temp.vector.copy(tile.location);
    this._temp.vector.negate();
    this._temp.matrix.identity();
    this._temp.matrix.setPosition(this._temp.vector);
    this._temp.matrix.multiply(sample.transform);
  }
  hasChanged(id, lod, vis, high) {
    const lodNeedsChanged = this.hasLodChanged(id, lod);
    const visibleChangd = this.hasVisibleChanged(id, vis);
    const highlightChanged = this.hasHighlightChanged(id, high);
    return lodNeedsChanged || visibleChangd || highlightChanged;
  }
  setupTileLocation(tile, geometry, sample) {
    if (tile.location) {
      return;
    }
    const result = new THREE.Vector3();
    result.fromArray(geometry.positionBuffer);
    result.applyMatrix4(sample.transform);
    tile.location = result;
  }
  getTileData(tile) {
    const locations = this.getTileLocations(tile);
    const visibilityData = this.getTileVisibility(tile, locations);
    const highlight = this.getTileHighlight(tile, locations);
    const { highlightData, highlightIds } = highlight;
    return { visibilityData, highlightData, highlightIds };
  }
  updateMemoryOnTileLoad(tile) {
    VirtualTilesController._graphicMemoryConsumed += tile.usedMemory;
  }
  fetchTileMatrixOnLoad(tile) {
    if (tile.location) {
      this._temp.matrix.identity();
      this._temp.matrix.setPosition(tile.location);
    }
  }
  updateItem(itemId) {
    const sampleIds = this._boxes.sampleOf(itemId);
    if (sampleIds) {
      for (const sampleId of sampleIds) {
        this.updateMesh(sampleId);
      }
    }
  }
  screenSize(dimension, distance) {
    const viewDimension = this.getViewDimension(distance);
    const screenDimension = dimension / viewDimension;
    return screenDimension * this._virtualView.viewSize;
  }
  getTileDimensionClass(box) {
    const size = box.min.distanceToSquared(box.max);
    const small = this._params.smallTileSize;
    const medium = this._params.mediumTileSize;
    if (size > medium) {
      return 2;
    }
    if (size > small) {
      return 1;
    }
    return 0;
  }
  getViewDimension(distance) {
    if (this._virtualView.orthogonalDimension) {
      return this._virtualView.orthogonalDimension;
    }
    const currentFov = this._virtualView.fov;
    const fovChanged = currentFov !== this._temp.pastFieldOfview;
    if (fovChanged) {
      this._temp.viewDimension = this.getPerspTrueDim(currentFov, 1);
      this._temp.pastFieldOfview = currentFov;
    }
    return distance * this._temp.viewDimension;
  }
  loadTile(tileId, tile) {
    const tileData = this.getTileData(tile);
    this.fetchTileMatrixOnLoad(tile);
    const faceIds = this.getFaceIds(tile);
    this._meshConnection.process({
      tileRequestClass: TileRequestClass.CREATE,
      modelId: this._modelId,
      objectClass: tile.objectClass,
      tileId,
      itemId: void 0,
      tileData,
      indices: tile.indexBuffer,
      positions: tile.positionBuffer,
      normals: tile.normalBuffer,
      faceIds,
      itemIds: tile.ids,
      localIds: this.getTileLocalIds(tile),
      material: tile.materialId,
      matrix: this._temp.matrix.clone(),
      aabb: tile.box.clone(),
      currentLod: tile.lod
    });
    this.updateMemoryOnTileLoad(tile);
  }
  /**
   * The localIds of the items a tile holds, each once. Sent with the
   * tile's CREATE so the main thread can keep `FragmentsModel.visibleItems`
   * without decoding the `id` attribute, which holds internal itemIds.
   */
  getTileLocalIds(tile) {
    const localIds = /* @__PURE__ */ new Set();
    let lastItemId = -1;
    for (const [sample] of tile.sampleLocation) {
      const itemId = this.itemId(sample);
      if (itemId === lastItemId) continue;
      lastItemId = itemId;
      const localIdIndex = this.meshes.meshesItems(itemId);
      if (localIdIndex === null) continue;
      const localId = this._model.localIds(localIdIndex);
      if (localId === null) continue;
      localIds.add(localId);
    }
    return Uint32Array.from(localIds);
  }
  getFaceIds(tile) {
    const tempColor = new THREE.Color();
    const faceIdBuffer = tile.faceIdBuffer;
    const faceIds = new Float32Array(faceIdBuffer.length * 3);
    for (let i = 0; i < faceIdBuffer.length; i++) {
      const id = faceIdBuffer[i];
      tempColor.set(0 + id);
      faceIds[i * 3] = tempColor.r;
      faceIds[i * 3 + 1] = tempColor.g;
      faceIds[i * 3 + 2] = tempColor.b;
    }
    return faceIds;
  }
  meshData(mesh, allowVoid, lod) {
    const id = this._temp.representation.id();
    const customLod = mesh.getLodClass() === LodClass.CUSTOM;
    const wiresLod = lod === CurrentLod.WIRES;
    if (customLod && wiresLod) {
      const meshWithLod = mesh;
      const result2 = meshWithLod.fetchLod(id, allowVoid);
      return result2;
    }
    const result = mesh.fetchMeshes(id, allowVoid);
    return result;
  }
  tileAppendAttribute(a, b, name, equal) {
    if (b[name] === void 0) {
      return;
    }
    if (equal) {
      a[name] = b[name];
      return;
    }
    a[name] += b[name];
  }
  itemId(sample) {
    this.meshes.samples(sample, this._temp.sample);
    return this._temp.sample.item();
  }
}
export {
  VirtualTilesController
};
//# sourceMappingURL=virtual-tiles-controller.mjs.map
