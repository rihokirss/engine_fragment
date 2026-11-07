import { MultiThreadingRequestClass, TileRequestClass } from "./model-types.mjs";
import { MaterialManager } from "./material-manager.mjs";
class RequestsManager {
  /**
   * List of requests.
   */
  list = [];
  /**
   * Checks if there are any pending requests.
   *
   * @returns `true` if there are pending requests, otherwise `false`.
   */
  get arePending() {
    return this.list.length > 0;
  }
  /**
   * Callback function to be invoked when a request with
   * `TileRequestClass.FINISH` is added. Receives the FINISH's `seq`
   * stamp (the highest RPC seq the worker had processed when emitting
   * this FINISH); used by the fence-based `forceUpdateFinish` to
   * resolve waiters whose target seq has now settled, per model.
   */
  onFinish = () => {
  };
  async handleRequest(meshes, request) {
    if (request.class === MultiThreadingRequestClass.RECOMPUTE_MESHES) {
      this.add(request.list);
      request.list = void 0;
    } else if (request.class === MultiThreadingRequestClass.CREATE_MATERIAL) {
      const { materialDefinitions, modelId, firstId } = request;
      MaterialManager.resetColors(materialDefinitions);
      meshes.materials.addDefinitions(modelId, materialDefinitions, firstId);
      request.materialDefinitions = void 0;
    } else if (request.class === MultiThreadingRequestClass.THROW_ERROR) {
      console.error(request);
    }
  }
  /**
   * Adds an array of requests to the list. If a request with `TileRequestClass.FINISH` is added,
   * the `onFinishRequest` callback is invoked.
   *
   * @param requests - Array of requests to be added.
   */
  add(requests) {
    for (const request of requests) {
      if (!this.insert(request)) this.list.push(request);
      if (request.tileRequestClass === TileRequestClass.FINISH) {
        this.onFinish(request.seq, request.modelId);
      }
    }
  }
  /**
   * Cleans the list by removing requests with the specified model ID and `TileRequestClass.FINISH`.
   *
   * @param modelID - The model ID to filter requests by.
   */
  clean(modelID) {
    const list = this.list.filter(
      (request) => request.modelId !== modelID || request.tileRequestClass !== TileRequestClass.FINISH
    );
    this.list = list;
  }
  /**
   * Inserts a request into the list based on its `tileRequestClass`.
   *
   * @param request - The request to be inserted.
   * @returns `true` if the request was successfully inserted, otherwise `false`.
   */
  insert(request) {
    const { modelId, tileId, tileRequestClass, tileData } = request;
    if (tileId === void 0) return false;
    if (tileRequestClass === TileRequestClass.DELETE) {
      const list = this.list.filter(
        (request2) => !((request2.tileRequestClass === TileRequestClass.CREATE || request2.tileRequestClass === TileRequestClass.DELETE) && request2.modelId === modelId && request2.tileId === tileId)
      );
      this.list = list;
    }
    if (tileRequestClass === TileRequestClass.CREATE) {
      const list = this.list.filter(
        (request2) => !(request2.tileRequestClass === TileRequestClass.CREATE && request2.modelId === modelId && request2.tileId === tileId)
      );
      this.list = list;
    }
    if (tileRequestClass === TileRequestClass.UPDATE) {
      const overriddenRequest = this.list.find(
        (request2) => request2.modelId === modelId && request2.tileId === tileId
      );
      if (overriddenRequest) {
        if (overriddenRequest.tileRequestClass === TileRequestClass.CREATE || overriddenRequest.tileRequestClass === TileRequestClass.UPDATE)
          overriddenRequest.tileData = tileData;
        return true;
      }
    }
    return false;
  }
}
export {
  RequestsManager
};
//# sourceMappingURL=requests-manager.mjs.map
