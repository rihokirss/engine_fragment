import * as THREE from "three";
import { FragmentsConnection } from "./src/multithreading/fragments-connection.mjs";
import { getBundledWorkerUrl } from "../bundled-worker-url.mjs";
import { setClassicGhostOpacity, CLASSIC_GHOST_OPACITY } from "./src/model/ghost-opacity.mjs";
import { FRAGMENTS_VERSION } from "../Utils/version.mjs";
import { Event } from "../Utils/event.mjs";
import { Editor } from "./src/edit/editor.mjs";
import { MeshManager } from "./src/model/mesh-manager.mjs";
import { FragmentsModel } from "./src/model/fragments-model.mjs";
import { isRawBuffer } from "./src/utils/misc/buffer.mjs";
import { MultiThreadingRequestClass } from "./src/model/model-types.mjs";
import { ALIGNMENT_CATEGORY, AlignmentCurveType, CurrentLod, GRID_CATEGORY, ItemConfigClass, LoadAbortedError, LodMode, ObjectClass, SnappingClass, TileRequestClass, limitOf2Bytes } from "./src/model/model-types.mjs";
class FragmentsModels {
  static _workerURL = null;
  static _workerPromise = null;
  /**
   * Fetches the fragments worker from unpkg for the exact version of this
   * `@thatopen/fragments` package and returns a blob URL you can pass to the
   * `FragmentsModels` constructor. The result is cached, so calling this
   * method more than once is cheap.
   *
   * This is the recommended way to obtain the worker URL — it guarantees the
   * worker version matches the library version and requires no copying of
   * files into your project.
   *
   * @example
   * ```ts
   * const workerURL = await FragmentsModels.getWorker();
   * const fragments = new FragmentsModels(workerURL);
   * ```
   *
   * @returns A blob URL pointing to the fragments worker script.
   */
  static async getWorker() {
    if (FragmentsModels._workerURL) return FragmentsModels._workerURL;
    if (FragmentsModels._workerPromise) return FragmentsModels._workerPromise;
    FragmentsModels._workerPromise = (async () => {
      const url = `https://unpkg.com/@thatopen/fragments@${FRAGMENTS_VERSION}/dist/Worker/worker.mjs`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch fragments worker from ${url}: ${response.status} ${response.statusText}`
        );
      }
      const blob = await response.blob();
      const file = new File([blob], "worker.mjs", { type: "text/javascript" });
      const objectURL = URL.createObjectURL(file);
      FragmentsModels._workerURL = objectURL;
      return objectURL;
    })();
    try {
      return await FragmentsModels._workerPromise;
    } catch (error) {
      FragmentsModels._workerPromise = null;
      throw error;
    }
  }
  /**
   * Event triggered when a model is loaded.
   * @event
   * @type {Event<FragmentsModel>}
   */
  onModelLoaded = new Event();
  /**
   * The manager that handles all loaded fragments models.
   * Provides functionality to:
   * - Store and retrieve models by ID
   * - Track model loading/unloading
   * - Coordinate updates across models
   * - Handle model disposal
   */
  models;
  /** Settings that control the behavior of the FragmentsModels system */
  settings = {
    /** Whether to automatically coordinate model positions relative to the first loaded model */
    autoCoordinate: true,
    /** Maximum rate (in milliseconds) at which visual updates are performed */
    maxUpdateRate: 100,
    /** Graphics quality level - 0 is low quality, 1 is high quality */
    graphicsQuality: 0,
    /**
     * @deprecated The polling-based force-flush implementation has
     * been replaced by a sequence-fence one (`forceUpdateFinish`
     * resolves the moment a FINISH stamped with the relevant seq
     * arrives). These knobs are no longer read; kept only to avoid
     * breaking apps that set them.
     */
    forceUpdateRate: 200,
    /** @deprecated See {@link forceUpdateRate}. */
    forceUpdateBuffer: 200,
    /**
     * Interval in milliseconds to flush queued mesh requests from thread to
     * main thread. Set this once at FragmentsModels construction; changing
     * it after a model has been loaded has no effect on already-loaded
     * models (they keep the value they were created with).
     *
     * Default 16 ms (one frame at 60 Hz). The previous 64 ms default
     * left tile updates sitting in the worker's outflow buffer for up
     * to ~1 frame longer than necessary; lowering it tightens the
     * latency between worker work and visible result on every
     * interaction. Apps with very heavy worker output may want to
     * raise this to reduce postMessage frequency.
     */
    meshConnectionRate: 16,
    /**
     * Number of queued mesh requests that triggers an immediate flush.
     * Same setup-time semantics as {@link meshConnectionRate}. Default
     * 4 — bursts of work flush within a frame instead of being
     * pinned to the rate timer.
     */
    meshConnectionThreshold: 4,
    /**
     * Delay in milliseconds between worker-side update loops when work is
     * complete. Note: each worker has a single shared update loop, so when
     * multiple models share a worker (default round-robin pool, or any
     * `threadGroup`), the most recently loaded model's value applies to
     * every model on that worker. Set this once at FragmentsModels
     * construction and treat it as a global tuning knob.
     *
     * Default 32 ms (~30 Hz). The previous 128 ms default left the
     * worker idling for up to ~8 frames between iterations, which on
     * interactive workloads showed up as visible lag between RPC and
     * visual settle. Apps with low-end CPUs may want to raise it to
     * reduce idle-loop overhead.
     */
    threadUpdaterDelay: 32
  };
  /** Coordinates of the first loaded model, used for coordinate system alignment */
  baseCoordinates = null;
  /** The editor instance for managing model edits and changes */
  editor;
  _connection;
  _progressCallbacks = /* @__PURE__ */ new Map();
  _isDisposed = false;
  _autoRedrawInterval = null;
  _lastUpdate = 0;
  _pendingForcedUpdate = null;
  // Handle and resolver of the coalesced forced update, kept so dispose()
  // can cancel the timer and still release whoever is awaiting it.
  _pendingForcedTimer = null;
  _pendingForcedResolve = null;
  /**
   * Creates a new FragmentsModels instance.
   *
   * The recommended way to obtain the worker URL is via {@link FragmentsModels.getWorker},
   * which fetches the version-matched worker from unpkg. See its docs for an example.
   *
   * @param workerURL - The URL of the worker script that will handle the fragments processing. If omitted, it falls back to the worker bundled with the package (only works with bundlers that can resolve `new URL("./Worker/worker.mjs", import.meta.url)`).
   * @param options - Optional configuration.
   */
  constructor(workerURL, options) {
    const url = workerURL ?? getBundledWorkerUrl();
    const requestEvent = this.newRequestEvent();
    const updateEvent = this.newUpdateEvent();
    this._connection = new FragmentsConnection(requestEvent, url, {
      classicWorker: options?.classicWorker,
      maxWorkers: options?.maxWorkers,
      threadGroups: options?.threadGroups
    });
    this.editor = new Editor(this, this._connection);
    this.models = new MeshManager(updateEvent);
    this.models.list.onItemDeleted.add(() => {
      if (this.models.list.size !== 0) return;
      this.baseCoordinates = null;
    });
  }
  /**
   * Effective max worker cap for this instance. Surfaces the value derived
   * from `navigator.hardwareConcurrency - 3` (floored at 2) or the explicit
   * `maxWorkers` override passed to the constructor.
   */
  get maxWorkers() {
    return this._connection.maxWorkers;
  }
  /**
   * Reserved worker capacity per named thread group, as declared at init.
   * Empty object if no groups were declared.
   */
  get threadGroups() {
    return this._connection.threadGroups;
  }
  _ghostOpacity = null;
  /**
   * How visible a ghosted element is (see {@link FragmentsModel.setGhostItems}),
   * 0 (gone) to 1 (as drawn): the fraction of its pixels kept, 0.28 by
   * default. One value for every model, changed at any time; what is ghosted
   * now is drawn again with it. A renderer that draws on demand needs its next
   * frame asked for.
   * @param alpha - The fraction of a ghosted surface's pixels kept, 0 to 1.
   */
  setGhostOpacity(alpha) {
    const value = Math.min(1, Math.max(0, Number(alpha)));
    if (!Number.isFinite(value)) return;
    this._ghostOpacity = value;
    setClassicGhostOpacity(value);
  }
  /**
   * Goes back to the default ghost opacity (0.28); {@link ghostOpacity} reads
   * null again.
   */
  resetGhostOpacity() {
    this._ghostOpacity = null;
    setClassicGhostOpacity(CLASSIC_GHOST_OPACITY);
  }
  /** The value last given to {@link setGhostOpacity}, or null while the default stands. */
  get ghostOpacity() {
    return this._ghostOpacity;
  }
  /**
   * Loads a fragments model from an ArrayBuffer.
   * @param buffer - The ArrayBuffer containing the fragments data to load.
   * @param options - Configuration options for loading the model.
   * @param options.modelId - Unique identifier for the model.
   * @param options.camera - Optional camera to use for model culling and LOD.
   * @param options.clippingPlanes - Optional clipping planes (world space) to cull against. The array is kept by reference and read on every view refresh; see {@link FragmentsModel.useClippingPlanes}.
   * @param options.raw - Whether the buffer is raw (uncompressed) or deflated. If omitted, it is auto-detected from the buffer (see {@link isRawBuffer}).
   * @param options.userData - Optional custom data to attach to the model.
   * @param options.virtualModelConfig - Optional configuration for virtual model setup.
   * @returns Promise resolving to the loaded FragmentsModel instance.
   */
  async load(buffer, options) {
    this._connection.setModelThreadGroup(options.modelId, options.threadGroup);
    const virtualModelConfig = {
      ...options.virtualModelConfig,
      multithreading: {
        meshConnectionRate: this.settings.meshConnectionRate,
        meshConnectionThreshold: this.settings.meshConnectionThreshold,
        threadUpdaterDelay: this.settings.threadUpdaterDelay,
        ...options.virtualModelConfig?.multithreading
      }
    };
    const model = new FragmentsModel(
      options.modelId,
      this.models,
      this._connection,
      this.editor,
      options.threadGroup
    );
    if (options.userData) {
      model.object.userData = options.userData;
    }
    model.frozen = true;
    model.graphicsQuality = this.settings.graphicsQuality;
    if (options.onProgress) {
      this._progressCallbacks.set(options.modelId, options.onProgress);
    }
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const raw = options.raw ?? isRawBuffer(bytes);
    try {
      this.models.list.set(model.modelId, model);
      await model._setup(buffer, raw, virtualModelConfig);
      if (this.settings.autoCoordinate) {
        const coordinates = await model.getCoordinates();
        if (this.baseCoordinates === null) {
          this.baseCoordinates = coordinates;
        } else {
          const [px, py, pz] = coordinates;
          const [baseX, baseY, baseZ] = this.baseCoordinates;
          const transform = new THREE.Vector3(
            baseX - px,
            baseY - py,
            baseZ - pz
          );
          model.object.position.add(transform);
        }
      }
    } catch (e) {
      this._progressCallbacks.delete(options.modelId);
      try {
        await model.dispose();
      } catch {
        this.models.list.delete(model.modelId);
      }
      throw e;
    } finally {
      this._progressCallbacks.delete(options.modelId);
    }
    const { camera, clippingPlanes } = options;
    if (camera) {
      model.useCamera(camera);
    }
    if (clippingPlanes) {
      model.useClippingPlanes(clippingPlanes);
    }
    model.frozen = false;
    this.onModelLoaded.trigger(model);
    return model;
  }
  /**
   * Disposes of all models managed by this FragmentsModels instance.
   * After calling this method, the FragmentsModels instance should not be used anymore.
   */
  async dispose() {
    this._isDisposed = true;
    if (this._autoRedrawInterval) {
      clearTimeout(this._autoRedrawInterval);
      this._autoRedrawInterval = null;
    }
    if (this._pendingForcedTimer) {
      clearTimeout(this._pendingForcedTimer);
      this._pendingForcedTimer = null;
    }
    if (this._pendingForcedResolve) {
      this._pendingForcedResolve();
      this._pendingForcedResolve = null;
    }
    this._pendingForcedUpdate = null;
    const models = Array.from(this.models.list.values());
    const promises = [];
    for (const model of models) {
      promises.push(model.dispose());
    }
    await Promise.all(promises);
    this.onModelLoaded.reset();
  }
  /**
   * Disposes of a specific model by its ID.
   * @param modelId - The unique identifier of the model to dispose.
   */
  async disposeModel(modelId) {
    const model = this.models.list.get(modelId);
    if (model) {
      await model.dispose();
    }
  }
  /**
   * Aborts an in-flight `load()` for the given model ID. The pending `load()`
   * promise will reject with a `LoadAbortedError` and any partial state
   * (on both the main thread and the worker) is disposed.
   *
   * Has no effect if the model finished loading or isn't currently loading.
   *
   * @param modelId - The unique identifier of the model to abort.
   */
  abort(modelId) {
    this._connection.fetch({
      class: MultiThreadingRequestClass.ABORT_MODEL,
      modelId
    });
  }
  /**
   * Updates all models managed by this FragmentsModels instance.
   * @param force - If true, it will force all the models to finish all the pending requests.
   */
  async update(force = false) {
    if (this._isDisposed) {
      return;
    }
    const now = performance.now();
    const elapsed = now - this._lastUpdate;
    if (elapsed < this.settings.maxUpdateRate) {
      if (!force) {
        this.scheduleNextUpdate();
        return;
      }
      if (!this._pendingForcedUpdate) {
        const delay = this.settings.maxUpdateRate - elapsed + 1;
        this._pendingForcedUpdate = new Promise((resolve) => {
          this._pendingForcedResolve = resolve;
          this._pendingForcedTimer = setTimeout(() => {
            this._pendingForcedTimer = null;
            this._pendingForcedResolve = null;
            this._pendingForcedUpdate = null;
            this.performUpdate(true).then(resolve, () => resolve());
          }, delay);
        });
      }
      return this._pendingForcedUpdate;
    }
    return this.performUpdate(force);
  }
  async performUpdate(force) {
    if (this._isDisposed) {
      return;
    }
    this._lastUpdate = performance.now();
    const modelUpdates = [];
    for (const model of this.models.list.values()) {
      modelUpdates.push(model._refreshView(force));
    }
    await Promise.all(modelUpdates);
    if (force) {
      await this.models.forceUpdateFinish();
    } else {
      this.models.update();
    }
    this.scheduleNextUpdate();
  }
  /**
   * (Re)schedules the next automatic update. The view-change gating
   * means an idle scene produces no worker messages and thus no
   * FINISH-driven update events, so the loop sustains itself with
   * this timer instead. Skipped when disposed or no models exist —
   * the next model load (or any mesh update event) restarts it.
   */
  scheduleNextUpdate() {
    if (this._isDisposed || this.models.list.size === 0) {
      return;
    }
    if (this._autoRedrawInterval) {
      clearTimeout(this._autoRedrawInterval);
    }
    const offset = this.settings.maxUpdateRate + 1;
    this._autoRedrawInterval = setTimeout(() => {
      this._autoRedrawInterval = null;
      this.update();
    }, offset);
  }
  async manageRequest(message) {
    if (message.class === MultiThreadingRequestClass.LOAD_PROGRESS) {
      const callback = this._progressCallbacks.get(message.modelId);
      if (callback) {
        callback({
          modelId: message.modelId,
          stage: message.stage,
          progress: message.progress
        });
      }
      return;
    }
    const model = this.models.list.get(message.modelId);
    if (model) {
      await model.handleRequest(message);
    }
  }
  newUpdateEvent() {
    return () => {
      if (this._isDisposed) return;
      if (this._autoRedrawInterval) {
        clearTimeout(this._autoRedrawInterval);
      }
      const offset = this.settings.maxUpdateRate + 1;
      this._autoRedrawInterval = setTimeout(() => {
        this._autoRedrawInterval = null;
        this.update();
      }, offset);
    };
  }
  newRequestEvent() {
    return (request) => {
      this.manageRequest(request);
    };
  }
}
export {
  ALIGNMENT_CATEGORY,
  AlignmentCurveType,
  CurrentLod,
  Editor,
  FragmentsModel,
  FragmentsModels,
  GRID_CATEGORY,
  ItemConfigClass,
  LoadAbortedError,
  LodMode,
  MultiThreadingRequestClass,
  ObjectClass,
  SnappingClass,
  TileRequestClass,
  isRawBuffer,
  limitOf2Bytes
};
//# sourceMappingURL=index.mjs.map
