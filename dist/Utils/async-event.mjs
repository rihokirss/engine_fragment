class AsyncEvent {
  enabled = true;
  add(handler) {
    this.handlers.push(handler);
  }
  remove(handler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }
  trigger = async (data) => {
    if (!this.enabled) {
      return;
    }
    const handlers = this.handlers.slice(0);
    for (const handler of handlers) {
      await handler(data);
    }
  };
  reset() {
    this.handlers.length = 0;
  }
  handlers = [];
}
export {
  AsyncEvent
};
//# sourceMappingURL=async-event.mjs.map
