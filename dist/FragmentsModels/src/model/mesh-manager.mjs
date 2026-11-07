import * as THREE from "three";
import { MaterialManager } from "./material-manager.mjs";
import { TileRequestClass, ObjectClass, CurrentLod } from "./model-types.mjs";
import { RequestsManager } from "./requests-manager.mjs";
import { LODManager } from "./lod-manager.mjs";
import { DataMap } from "../../../Utils/data-map.mjs";
function updateTileWorldMatrix(updateParents, updateChildren) {
  THREE.Object3D.prototype.updateWorldMatrix.call(
    this,
    updateParents,
    updateChildren,
    true
  );
}
class MeshManager {
  /**
   * A map of FragmentsModel instances by their model ID.
   */
  list = new DataMap();
  materials = new MaterialManager();
  lod = new LODManager(this.materials);
  requests = new RequestsManager();
  updateThreshold = 4;
  /**
   * Per model, how many live tiles hold each item of `visibleItems`.
   * Weak so a disposed model takes its counts with it.
   */
  _itemTileCounts = /* @__PURE__ */ new WeakMap();
  /**
   * Pending fence resolvers from `forceUpdateFinish` callers.
   * Each entry holds the refreshes that were unanswered at call time;
   * once every one of them has its FINISH, we drain the queue to
   * completion and resolve. Sorted insertion order isn't needed
   * — we walk the whole list on each FINISH.
   */
  _fenceWaiters = [];
  /**
   * Per model, the seq of the last REFRESH_VIEW sent and the highest seq
   * stamped on one of its FINISHes. A single global seq is not enough
   * with several models: the stamp is the worker's latest seq, so the
   * FINISH of a model with a short pass carries the seq of the refresh
   * sent to the next model and released the fence while that one was
   * still sweeping.
   *
   * Only refreshes are tracked because they are the only requests the
   * worker is bound to answer with a FINISH. Waiting for the last seq
   * dispatched instead hung `update(true)` whenever any other request
   * (a pick, a data query, a request of another FragmentsModels
   * instance, which shares the seq counter) went out after the refresh:
   * no FINISH this instance receives ever carries that seq (#341).
   */
  _viewSeq = /* @__PURE__ */ new Map();
  _finishSeq = /* @__PURE__ */ new Map();
  _onUpdate;
  constructor(onUpdate) {
    this._onUpdate = onUpdate;
    this.requests.onFinish = (seq, modelId) => this.handleFinish(seq, modelId);
    this.list.onItemDeleted.add((modelId) => {
      this._viewSeq.delete(modelId);
      this._finishSeq.delete(modelId);
      this.finishEmptyScene();
      this.resolveReadyWaiters();
    });
    this.list.onCleared.add(() => {
      this._viewSeq.clear();
      this._finishSeq.clear();
      this.finishEmptyScene();
    });
  }
  /**
   * Records that a REFRESH_VIEW with `seq` was sent for `modelId`. The
   * worker answers every refresh with a FINISH once that view is done
   * (right away if it was already), so fences wait for it.
   */
  viewDispatched(modelId, seq) {
    if (typeof seq === "number") this._viewSeq.set(modelId, seq);
  }
  /**
   * Wait until every view refresh sent before this call has been
   * answered by its model's FINISH AND the resulting tile updates
   * have been applied on main. A worker handles its messages in
   * order, so whatever was sent to a model before its refresh is
   * reflected too. Replaces the old polling-based implementation:
   *
   *   - **Old**: `setInterval` re-running `update()` every `rate` ms
   *     until a FINISH arrived, plus a `buffer` setTimeout guarding
   *     against false-positive FINISHes from prior batches. Floor of
   *     ~rate + buffer ms even when the worker had nothing to do.
   *   - **New**: snapshot, per model, the seq of the refresh still
   *     unanswered, register a fence waiter, resolve the moment each
   *     of those models has a FINISH stamped with `seq >= snapshot`
   *     and the request queue has been drained. Zero polling; precise
   *     per-call settlement.
   *
   * Called from `FragmentsModels.update(true)`.
   */
  async forceUpdateFinish() {
    const views = /* @__PURE__ */ new Map();
    for (const [modelId, seq] of this._viewSeq) {
      if ((this._finishSeq.get(modelId) ?? 0) < seq) views.set(modelId, seq);
    }
    const waiter = { views, resolve: () => {
    } };
    if (this.list.size === 0 || this.isSettled(waiter)) {
      this.drainAll();
      return;
    }
    await new Promise((resolve) => {
      waiter.resolve = resolve;
      this._fenceWaiters.push(waiter);
    });
  }
  isSettled(waiter) {
    for (const [modelId, seq] of waiter.views) {
      if (!this.list.has(modelId)) continue;
      if ((this._finishSeq.get(modelId) ?? 0) < seq) return false;
    }
    return true;
  }
  finishEmptyScene() {
    if (this.list.size !== 0) return;
    this.drainAll();
    const waiters = this._fenceWaiters;
    this._fenceWaiters = [];
    for (const waiter of waiters) waiter.resolve();
  }
  /**
   * Called by `RequestsManager` whenever a FINISH tile request lands
   * on main. The FINISH is stamped with the worker's `lastSeenSeq`
   * at emission time, which is also the highest RPC seq whose effects
   * are reflected in the batch carrying this FINISH.
   *
   * Walks the fence-waiter list and resolves any whose `targetSeq`
   * has now settled, draining the request queue first so the visual
   * effects are on screen by the time the awaiter wakes up.
   */
  handleFinish(seq, modelId) {
    if (typeof seq === "number" && modelId !== void 0) {
      if (seq > (this._finishSeq.get(modelId) ?? 0)) {
        this._finishSeq.set(modelId, seq);
      }
    }
    this.drainAll();
    this.resolveReadyWaiters();
  }
  resolveReadyWaiters() {
    if (this._fenceWaiters.length === 0) return;
    const ready = [];
    const remaining = [];
    for (const w of this._fenceWaiters) {
      if (this.isSettled(w)) ready.push(w.resolve);
      else remaining.push(w);
    }
    if (ready.length === 0) return;
    this._fenceWaiters = remaining;
    for (const r of ready) r();
  }
  /**
   * Process every queued tile request without the per-frame
   * `updateThreshold` cap. Used by force-flush paths where the
   * caller is explicitly waiting for everything to settle —
   * spreading the work across many frames there would just delay
   * the visual.
   */
  drainAll() {
    while (this.requests.arePending) {
      const request = this.requests.list.shift();
      if (!request) continue;
      this.processTileRequest(request);
      this._onUpdate();
    }
  }
  update() {
    const start = performance.now();
    while (this.requests.arePending) {
      const request = this.requests.list.shift();
      if (!request) continue;
      this.processTileRequest(request);
      this._onUpdate();
      if (performance.now() - start > this.updateThreshold) return;
    }
  }
  setTileData(mesh, request) {
    const { tileId, itemId, matrix, aabb } = request;
    this.setMeshData(mesh, tileId, itemId, matrix);
    this.setupBoundings(mesh, aabb);
    this.updateStatus(mesh, request);
  }
  processTileRequest(request) {
    const { tileRequestClass, tileId, modelId } = request;
    const model = this.list.get(modelId);
    if (!model) return;
    if (tileRequestClass === TileRequestClass.CREATE) {
      if (request.objectClass === void 0) return;
      const tile = this.create(request);
      this.setTileData(tile, request);
      this.untrackTileItems(model, model.tiles.get(tileId));
      const localIds = this.toLocalIds(request.localIds);
      tile.userData.itemIds = localIds;
      this.trackVisibleItems(model, localIds, true);
      model.tiles.set(tile.userData.tileId, tile);
    } else if (tileRequestClass === TileRequestClass.DELETE) {
      this.untrackTileItems(model, model.tiles.get(tileId));
      model.tiles.delete(tileId);
    } else if (tileRequestClass === TileRequestClass.UPDATE) {
      const tileObject = model.tiles.get(tileId);
      if (tileObject) this.updateStatus(tileObject, request);
    } else if (tileRequestClass === TileRequestClass.FINISH) {
      model._finishProcessing();
    }
  }
  toLocalIds(localIds) {
    if (!localIds) return new Uint32Array(0);
    if (localIds instanceof Uint32Array) return localIds;
    return Uint32Array.from(localIds);
  }
  untrackTileItems(model, tile) {
    const localIds = tile?.userData.itemIds;
    if (!localIds) return;
    tile.userData.itemIds = void 0;
    this.trackVisibleItems(model, localIds, false);
  }
  /**
   * Keeps `model.visibleItems` as the set of items held by at least one
   * live tile. An item can be in several tiles, so each one counts the
   * tiles that hold it and leaves the set when the last of them goes.
   */
  trackVisibleItems(model, localIds, added) {
    let counts = this._itemTileCounts.get(model);
    if (!counts || model.visibleItems.size === 0) {
      counts = /* @__PURE__ */ new Map();
      this._itemTileCounts.set(model, counts);
    }
    for (let i = 0; i < localIds.length; i++) {
      const localId = localIds[i];
      const count = counts.get(localId) ?? 0;
      if (added) {
        counts.set(localId, count + 1);
        if (count === 0) model.visibleItems.add(localId);
      } else if (count > 1) {
        counts.set(localId, count - 1);
      } else if (count === 1) {
        counts.delete(localId);
        model.visibleItems.delete(localId);
      }
    }
  }
  createMesh(request) {
    const { indices, positions, normals, itemIds, faceIds } = request;
    const geometry = new THREE.BufferGeometry();
    this.setIndex(geometry, indices);
    this.setPositions(positions, geometry);
    this.setNormals(normals, geometry);
    this.setItemIds(itemIds, geometry);
    this.setFaceIds(faceIds, geometry);
    const material = this.materials.getFromRequest(request);
    return new THREE.Mesh(geometry, [material]);
  }
  setupBoundings(mesh, aabb) {
    const { geometry } = mesh;
    const box = new THREE.Box3().copy(aabb);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    geometry.boundingBox = box;
    geometry.boundingSphere = sphere;
  }
  create(request) {
    if (request.objectClass === ObjectClass.SHELL)
      return this.createMesh(request);
    if (request.objectClass === ObjectClass.LINE) {
      const geometry = new THREE.BufferGeometry();
      return this.lod.createMesh(geometry, request);
    }
    throw new Error(
      `Fragments: object class ${request.objectClass} is not supported.`
    );
  }
  updateStatus(mesh, request) {
    const {
      tileData: { highlightData, visibilityData },
      currentLod
    } = request;
    const { geometry } = mesh;
    geometry.clearGroups();
    if (currentLod !== CurrentLod.WIRES && this.applyCompactIndex(geometry, visibilityData, !!highlightData)) {
      return;
    }
    this.lod.processMesh(mesh, request);
    if (!highlightData) return;
    if (currentLod === CurrentLod.WIRES) {
      this.lod.applyHighlight(mesh, request);
      return;
    }
    const materials = this.materials.createHighlights(mesh, request);
    mesh.material = materials;
  }
  /**
   * Minimum number of visibility runs before a shell tile switches from
   * one geometry.group per run (one draw call each) to a compacted index
   * buffer drawn with a single call. Small run counts stay on the group
   * path: the copy is not worth it and highlights need groups anyway.
   */
  static compactMinRuns = 3;
  /**
   * Rewrite the tile's GPU index with just the visible runs so the whole
   * tile is one draw call. Returns false (after restoring the full index
   * if it was compacted before) when the group path must be used:
   * LOD/wire meshes, tiles without a CPU index copy, highlighted tiles
   * (highlight groups address the full index) and tiles with few runs.
   */
  applyCompactIndex(geometry, visibilityData, hasHighlight) {
    const full = geometry.userData.fullIndex;
    const index = geometry.index;
    if (!full || !index) return false;
    const runs = visibilityData ? visibilityData.position.length : 0;
    if (hasHighlight || runs < MeshManager.compactMinRuns) {
      this.restoreFullIndex(geometry, full);
      return false;
    }
    const target = index.array;
    const { position, size } = visibilityData;
    let count = 0;
    for (let i = 0; i < runs; i++) {
      const start = position[i];
      const isWhite = size[i] === this.white;
      const end = isWhite ? full.length : Math.min(full.length, start + size[i]);
      if (end <= start) continue;
      target.set(full.subarray(start, end), count);
      count += end - start;
    }
    index.needsUpdate = true;
    geometry.setDrawRange(0, count);
    geometry.addGroup(0, count, 0);
    geometry.userData.compactIndex = true;
    return true;
  }
  restoreFullIndex(geometry, full) {
    if (!geometry.userData.compactIndex) return;
    const index = geometry.index;
    index.array.set(full);
    index.needsUpdate = true;
    geometry.setDrawRange(0, Infinity);
    geometry.userData.compactIndex = false;
  }
  // TODO: Deduplicate with other white values (LODManager, MaterialManager)
  white = 4294967295;
  cleanAttributeMemory(geometry, name) {
    const attr = geometry.attributes[name];
    attr.onUpload(this.deleteAttribute(geometry));
  }
  setPositions(positions, geometry) {
    if (!positions) {
      throw new Error("Fragments: no positions provided to create the mesh.");
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.cleanAttributeMemory(geometry, "position");
  }
  setFaceIds(faceIds, geometry) {
    if (faceIds) {
      geometry.setAttribute("color", new THREE.BufferAttribute(faceIds, 3));
      this.cleanAttributeMemory(geometry, "color");
    }
  }
  setIndex(geometry, indices) {
    if (!indices) {
      throw new Error("Fragments: no indices provided to create the mesh.");
    }
    const full = indices;
    const gpu = full.slice();
    geometry.setIndex(new THREE.BufferAttribute(gpu, 1));
    geometry.userData.fullIndex = full;
    geometry.userData.compactIndex = false;
  }
  setNormals(normals, geometry) {
    if (normals) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(normals, 3, true)
      );
    }
    this.cleanAttributeMemory(geometry, "normal");
  }
  setItemIds(itemIds, geometry) {
    if (itemIds) {
      geometry.setAttribute("id", new THREE.BufferAttribute(itemIds, 4, false));
      this.cleanAttributeMemory(geometry, "id");
    }
  }
  deleteAttribute(_geometry) {
    function callback() {
      delete this.array;
    }
    return callback;
  }
  setMeshData(mesh, tileId, itemId, matrix) {
    mesh.userData = { tileId, itemId };
    mesh.matrixAutoUpdate = false;
    mesh.applyMatrix4(matrix);
    mesh.matrix.copy(matrix);
    mesh.matrixWorldNeedsUpdate = true;
    mesh.updateWorldMatrix = updateTileWorldMatrix;
  }
}
export {
  MeshManager
};
//# sourceMappingURL=mesh-manager.mjs.map
