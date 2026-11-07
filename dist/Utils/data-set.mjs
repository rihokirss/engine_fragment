import { Event } from "./event.mjs";
class DataSet extends Set {
  onUpdated = new Event();
  onItemAdded = new Event();
  onBeforeDelete = new Event();
  onItemDeleted = new Event();
  onCleared = new Event();
  set eventsEnabled(value) {
    this.onUpdated.enabled = value;
    this.onItemAdded.enabled = value;
    this.onItemDeleted.enabled = value;
    this.onBeforeDelete.enabled = value;
    this.onCleared.enabled = value;
  }
  constructor(iterable) {
    super(iterable);
  }
  clear() {
    for (const item of this) {
      this.onBeforeDelete.trigger(item);
    }
    super.clear();
    this.onCleared.trigger();
    this.onUpdated.trigger();
  }
  add(...value) {
    for (const item of value) {
      const existing = this.has(item);
      if (existing) continue;
      const guard = this.guard ?? (() => true);
      const isValid = guard(item);
      if (!isValid) continue;
      super.add(item);
      if (!this.onItemAdded) this.onItemAdded = new Event();
      this.onItemAdded.trigger(item);
    }
    if (!this.onUpdated) this.onUpdated = new Event();
    this.onUpdated.trigger();
    return this;
  }
  guard = () => true;
  deleteGuard = () => true;
  delete(value) {
    const exist = this.has(value);
    if (!exist) return false;
    if (!this.deleteGuard(value)) return false;
    this.onBeforeDelete.trigger(value);
    const deleted = super.delete(value);
    if (deleted) {
      this.onItemDeleted.trigger();
      this.onUpdated.trigger();
    }
    return deleted;
  }
  deleteIf(predicate) {
    for (const v of this) {
      if (predicate(v)) {
        this.delete(v);
      }
    }
  }
  getIndex(item) {
    let index = 0;
    for (const value of this) {
      if (value === item) return index;
      index++;
    }
    return -1;
  }
  dispose() {
    this.clear();
    this.onItemAdded.reset();
    this.onItemDeleted.reset();
    this.onCleared.reset();
    this.onBeforeDelete.reset();
    this.onUpdated.reset();
  }
}
export {
  DataSet
};
//# sourceMappingURL=data-set.mjs.map
