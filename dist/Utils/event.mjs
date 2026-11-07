class Event {
  enabled = true;
  add(handler) {
    this.handlers.push(handler);
  }
  remove(handler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }
  trigger = (data) => {
    if (!this.enabled) {
      return;
    }
    const handlers = this.handlers.slice(0);
    for (const handler of handlers) {
      handler(data);
    }
  };
  reset() {
    this.handlers.length = 0;
  }
  handlers = [];
}
export {
  Event
};
//# sourceMappingURL=event.mjs.map
