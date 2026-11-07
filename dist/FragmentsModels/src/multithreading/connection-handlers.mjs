class ConnectionHandlers {
  _list = /* @__PURE__ */ new Map();
  _communicationKey = 0;
  setupInput(input) {
    input.requestId = this._communicationKey++;
  }
  set(id, reject, resolve) {
    const handler = this.newHandler(reject, resolve);
    this._list.set(id, handler);
  }
  // It resolves the awaited model.threads.fetch(...)
  run(data) {
    const handler = this._list.get(data.requestId);
    this._list.delete(data.requestId);
    handler(data);
  }
  newHandler(reject, resolve) {
    return (response) => {
      if (response.errorInfo) {
        reject(response.errorInfo);
        return;
      }
      resolve(response);
    };
  }
}
export {
  ConnectionHandlers
};
//# sourceMappingURL=connection-handlers.mjs.map
