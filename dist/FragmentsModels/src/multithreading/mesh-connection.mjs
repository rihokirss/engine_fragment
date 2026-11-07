import { MultithreadingHelper } from "./multithreading-helper.mjs";
class MeshConnection {
  _rate = 64;
  _updater;
  _modelId;
  _threshold = 16;
  _connection;
  _list = [];
  get needsRefresh() {
    return this._list.length > this._threshold;
  }
  constructor(modelId, connection, multithreading) {
    this._modelId = modelId;
    this._connection = connection;
    const configuredRate = multithreading?.meshConnectionRate;
    if (typeof configuredRate === "number" && Number.isFinite(configuredRate) && configuredRate >= 0) {
      this._rate = configuredRate;
    }
    const configuredThreshold = multithreading?.meshConnectionThreshold;
    if (typeof configuredThreshold === "number" && Number.isFinite(configuredThreshold) && configuredThreshold >= 0) {
      this._threshold = configuredThreshold;
    }
    if (this._connection) {
      this._updater = MultithreadingHelper.newUpdater(this.refresh, this._rate);
    }
  }
  dispose() {
    if (this._updater !== void 0) {
      MultithreadingHelper.deleteUpdater(this._updater);
      this._updater = void 0;
    }
  }
  clean() {
    this._list = MultithreadingHelper.cleanRequests(this._list);
  }
  process(request) {
    if (!this._connection) {
      return;
    }
    this._list.push(request);
    if (this.needsRefresh) {
      this.refresh();
    }
  }
  refresh = () => {
    if (!this._connection) {
      return;
    }
    if (this._list.length) {
      const current = this._list;
      this._connection.fetchMeshCompute(this._modelId, current);
      this._list = [];
    }
  };
}
export {
  MeshConnection
};
//# sourceMappingURL=mesh-connection.mjs.map
