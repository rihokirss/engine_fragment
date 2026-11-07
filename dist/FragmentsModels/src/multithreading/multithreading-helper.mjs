import * as THREE from "three";
import { MultiThreadingRequestClass, TileRequestClass } from "../model/model-types.mjs";
class MultithreadingHelper {
  static newThread(url, classic) {
    return classic ? new Worker(url) : new Worker(url, { type: "module" });
  }
  static newUpdater(effect, rate) {
    return setInterval(effect, rate);
  }
  static getMeshComputeRequest(modelId, list) {
    const className = MultiThreadingRequestClass.RECOMPUTE_MESHES;
    return { class: className, modelId, list };
  }
  static planeSet(planes) {
    const planeSet = [];
    for (const plane of planes) {
      const newNormal = this.array(plane.normal);
      const newConstant = plane.constant;
      const newPlane = new THREE.Plane(newNormal, newConstant);
      planeSet.push(newPlane);
    }
    return planeSet;
  }
  static data(data) {
    const isTransform = data?.elements !== void 0;
    if (isTransform) {
      return MultithreadingHelper.transform(data);
    }
    const isBeam = data?.origin !== void 0 && data?.direction !== void 0;
    if (isBeam) {
      return MultithreadingHelper.beam(data);
    }
    const isFrustum = data?.planes !== void 0;
    if (isFrustum) {
      return MultithreadingHelper.frustum(data);
    }
    const hasNormal = data?.normal !== void 0;
    const hasConstant = data?.constant !== void 0;
    const isPlane = hasNormal && hasConstant;
    if (isPlane) {
      return MultithreadingHelper.plane(data);
    }
    const hasNormalSet = data[0]?.normal !== void 0;
    const hasConstantSet = data[0]?.constant !== void 0;
    const isPlaneSet = hasNormalSet && hasConstantSet;
    if (isPlaneSet) {
      return MultithreadingHelper.planeSet(data);
    }
    const hasX = data?.x !== void 0;
    const hasY = data?.y !== void 0;
    const hasZ = data?.z !== void 0;
    const isArray = hasX && hasY && hasZ;
    if (isArray) {
      return MultithreadingHelper.array(data);
    }
    return data;
  }
  /**
   * Monotonic sequence counter for RPC fence tracking. Every EXECUTE
   * request gets a fresh seq; the worker tags emitted FINISH tile
   * requests with the highest seq it has processed since the previous
   * FINISH, and main uses that to resolve `forceUpdateFinish` waiters
   * without polling.
   *
   * Module-level rather than per-FragmentsModels because the seq
   * space only needs to be unique across messages a single main
   * thread is sending; multiple FragmentsModels in the same window
   * would race on a shared counter regardless. This is simpler and
   * avoids threading through the helper's API.
   */
  static _seq = 0;
  /**
   * Last seq dispatched, by any FragmentsModels instance. Not a fence
   * target: most requests are never answered by a FINISH (#341).
   */
  static get lastDispatchedSeq() {
    return MultithreadingHelper._seq;
  }
  static nextSeq() {
    MultithreadingHelper._seq += 1;
    return MultithreadingHelper._seq;
  }
  static getExecuteRequest(modelId, method, args) {
    const parameters = Array.from(args);
    const className = MultiThreadingRequestClass.EXECUTE;
    return { class: className, modelId, function: method, parameters };
  }
  static plane(plane) {
    const newNormal = this.array(plane.normal);
    const newConstant = plane.constant;
    const newPlane = new THREE.Plane(newNormal, newConstant);
    return newPlane;
  }
  static getRequestContent(input) {
    const content = [];
    for (const request of input.list) {
      MultithreadingHelper.setupCreateRequest(request, content);
      MultithreadingHelper.setupUpdateRequest(request, content);
    }
    return content;
  }
  static array(vector) {
    const array = new THREE.Vector3();
    array.set(vector.x, vector.y, vector.z);
    return array;
  }
  static cleanRequests(list) {
    const tasks = [];
    const helper = MultithreadingHelper;
    for (const request of list) {
      const isFinish = helper.isFinishRequest(request);
      if (!isFinish) {
        tasks.push(request);
      }
    }
    return tasks;
  }
  static frustum(frustum) {
    const newPlane = this.planeSet(frustum.planes);
    const [a, b, c, d, e, f] = newPlane;
    return new THREE.Frustum(a, b, c, d, e, f);
  }
  static beam(ray) {
    const newOrigin = this.array(ray.origin);
    const newDirection = this.array(ray.direction);
    return new THREE.Ray(newOrigin, newDirection);
  }
  static transform(matrix) {
    const newMatrix = new THREE.Matrix4();
    newMatrix.copy(matrix);
    return newMatrix;
  }
  static deleteUpdater(updater) {
    clearInterval(updater);
  }
  static areCoresAvailable(currentThreads) {
    const capacity = MultithreadingHelper.getCpuCapacity();
    const availableThreads = Math.max(capacity, 2);
    return currentThreads < availableThreads;
  }
  /**
   * Effective max worker cap. Defaults to navigator.hardwareConcurrency - 3,
   * floored at 2 (matching the legacy areCoresAvailable behavior). Callers
   * may pass an explicit override (e.g. CI environments or apps that know
   * their workload). Floors at 2 even when overridden.
   */
  static getMaxWorkers(override) {
    if (override !== void 0) {
      if (!Number.isFinite(override) || override < 2) {
        throw new Error(
          `Fragments: maxWorkers must be a finite number >= 2 (got ${override}).`
        );
      }
      return Math.floor(override);
    }
    const capacity = MultithreadingHelper.getCpuCapacity();
    return Math.max(capacity, 2);
  }
  static isFinishRequest(request) {
    return request.tileRequestClass === TileRequestClass.FINISH;
  }
  static setupUpdateRequest(request, content) {
    if (request.tileRequestClass === TileRequestClass.UPDATE) {
      this.addAllTileData(request, content);
    }
  }
  static getCpuCapacity() {
    const freeCores = 3;
    if (globalThis.navigator?.hardwareConcurrency) {
      return navigator.hardwareConcurrency - freeCores;
    }
    return 0;
  }
  static addAllTileData(request, content) {
    this.addRequestTileData(request, content, "visibilityData");
    const extras = ["highlightIds"];
    this.addRequestTileData(request, content, "highlightData", extras);
  }
  static addRequestContent(id, request, content) {
    if (!request[id]) return;
    const buffer = request[id].buffer;
    content.push(buffer);
  }
  static addRequestTileData(request, content, name, extras = []) {
    const data = request.tileData[name];
    if (data) {
      content.push(data.position.buffer);
      content.push(data.size.buffer);
      for (const extra of extras) {
        content.push(request.tileData[extra].buffer);
      }
    }
  }
  static setupCreateRequest(request, content) {
    if (request.tileRequestClass !== TileRequestClass.CREATE) {
      return;
    }
    const ids = this.getCreateRequestIds();
    for (const id of ids) {
      this.addRequestContent(id, request, content);
    }
    this.addAllTileData(request, content);
  }
  static getCreateRequestIds() {
    return ["positions", "indices", "normals", "itemIds"];
  }
}
export {
  MultithreadingHelper
};
//# sourceMappingURL=multithreading-helper.mjs.map
