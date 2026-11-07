import { EditRequestType, isIndexRequest } from "../../../Utils/edit/edit-types.mjs";
class EditRequestIndex {
  /** Local ids with a pending DELETE_ITEM request. */
  deletedItems = /* @__PURE__ */ new Set();
  _byLocalId = /* @__PURE__ */ new Map();
  _deleteCounts = /* @__PURE__ */ new Map();
  _source = null;
  _size = 0;
  /**
   * Makes sure the index reflects `requests`. Cheap when the tracked array is
   * unchanged; rebuilds when it was replaced or its length drifted.
   */
  sync(requests) {
    if (this._source === requests && this._size === requests.length) {
      return;
    }
    this.rebuild(requests);
  }
  rebuild(requests) {
    this._byLocalId.clear();
    this._deleteCounts.clear();
    this.deletedItems.clear();
    this._source = requests;
    this._size = 0;
    for (const request of requests) {
      this.push(request);
    }
  }
  /** Registers a request that was just appended to the tracked array. */
  push(request) {
    this._size++;
    const localId = this.localIdOf(request);
    if (localId === void 0) {
      return;
    }
    let list = this._byLocalId.get(localId);
    if (!list) {
      list = [];
      this._byLocalId.set(localId, list);
    }
    list.push(request);
    if (request.type === EditRequestType.DELETE_ITEM && typeof localId === "number") {
      this._deleteCounts.set(
        localId,
        (this._deleteCounts.get(localId) ?? 0) + 1
      );
      this.deletedItems.add(localId);
    }
  }
  /** Unregisters a request that was just removed from the tracked array. */
  pop(request) {
    this._size--;
    const localId = this.localIdOf(request);
    if (localId === void 0) {
      return;
    }
    const list = this._byLocalId.get(localId);
    if (list) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === request) {
          list.splice(i, 1);
          break;
        }
      }
      if (list.length === 0) {
        this._byLocalId.delete(localId);
      }
    }
    if (request.type === EditRequestType.DELETE_ITEM && typeof localId === "number") {
      const count = (this._deleteCounts.get(localId) ?? 1) - 1;
      if (count > 0) {
        this._deleteCounts.set(localId, count);
      } else {
        this._deleteCounts.delete(localId);
        this.deletedItems.delete(localId);
      }
    }
  }
  /** Newest pending request of one of the given types targeting `localId`. */
  latest(localId, ...types) {
    const list = this._byLocalId.get(localId);
    if (!list) {
      return void 0;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const request = list[i];
      if (types.includes(request.type)) {
        return request;
      }
    }
    return void 0;
  }
  /** Oldest pending request of one of the given types targeting `localId`. */
  first(localId, ...types) {
    const list = this._byLocalId.get(localId);
    if (!list) {
      return void 0;
    }
    for (const request of list) {
      if (types.includes(request.type)) {
        return request;
      }
    }
    return void 0;
  }
  localIdOf(request) {
    if (isIndexRequest(request)) {
      return void 0;
    }
    return request.localId;
  }
}
export {
  EditRequestIndex
};
//# sourceMappingURL=edit-request-index.mjs.map
