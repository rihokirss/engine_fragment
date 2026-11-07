const DEFAULT_POOL = "__default__";
class ThreadsData {
  _modelThread = /* @__PURE__ */ new Map();
  _threadsModelAmount = /* @__PURE__ */ new Map();
  _threadPort = /* @__PURE__ */ new Map();
  _threadPath;
  _placeholder;
  // Per-thread group tag. Default-pool threads use DEFAULT_POOL.
  _threadGroup = /* @__PURE__ */ new Map();
  // Per-model group tag, mirrors what the user passed at load().
  _modelGroup = /* @__PURE__ */ new Map();
  get path() {
    return this._threadPath;
  }
  constructor(threadPath) {
    this._placeholder = {};
    this._threadPath = threadPath;
  }
  usePlaceholder(id) {
    this._modelThread.set(id, this._placeholder);
  }
  getAmount(thread) {
    return this._threadsModelAmount.get(thread);
  }
  getThread(modelId) {
    return this._modelThread.get(modelId);
  }
  getAndCheckThread(id) {
    const thread = this._modelThread.get(id);
    if (thread === this._placeholder) {
      throw new Error("Fragments: Error fetching thread!");
    }
    return thread;
  }
  set(modelId, thread) {
    this._modelThread.set(modelId, thread);
  }
  setModelGroup(modelId, group) {
    this._modelGroup.set(modelId, group);
  }
  getModelGroup(modelId) {
    return this._modelGroup.get(modelId);
  }
  setThreadGroup(thread, group) {
    this._threadGroup.set(thread, group ?? DEFAULT_POOL);
  }
  getThreadGroup(thread) {
    const group = this._threadGroup.get(thread);
    if (group === void 0 || group === DEFAULT_POOL) return void 0;
    return group;
  }
  /**
   * Number of threads currently registered for the given group, or for the
   * default pool when `group` is undefined.
   */
  getThreadAmountForGroup(group) {
    const target = group ?? DEFAULT_POOL;
    let count = 0;
    for (const value of this._threadGroup.values()) {
      if (value === target) count++;
    }
    return count;
  }
  deleteModel(modelId) {
    const modelThread = this.getThreadSafe(modelId);
    const threadModelAmount = this.getAmountSafe(modelThread);
    const newModelAmount = threadModelAmount - 1;
    this.setAmount(modelThread, newModelAmount);
    this._modelThread.delete(modelId);
    this._modelGroup.delete(modelId);
  }
  getThreadSafe(modelId) {
    const thread = this.getThread(modelId);
    if (!thread) {
      throw new Error(`Fragments: Thread for model ${modelId} not found`);
    }
    return thread;
  }
  deleteThread(thread) {
    this._threadsModelAmount.delete(thread);
    this._threadPort.delete(thread);
    this._threadGroup.delete(thread);
    thread.terminate();
  }
  getThreadAmount() {
    return this._threadsModelAmount.size;
  }
  /**
   * Round-robin balancing within the given group only. The default pool and
   * each named group are independent, so a "data" model never lands on a
   * "geometry" worker, and a default-pool model never lands on a reserved
   * worker even if that worker is idle.
   */
  balanceThreadLoad(input, group) {
    const target = group ?? DEFAULT_POOL;
    let lessBusyThread = null;
    let modelAmount = Number.MAX_VALUE;
    for (const [thread, amount] of this._threadsModelAmount) {
      if (this._threadGroup.get(thread) !== target) continue;
      if (amount < modelAmount) {
        modelAmount = amount;
        lessBusyThread = thread;
      }
    }
    if (!lessBusyThread) {
      throw new Error(
        `Fragments: no worker available for thread group "${target}".`
      );
    }
    this._threadsModelAmount.set(lessBusyThread, modelAmount + 1);
    this._modelThread.set(input.modelId, lessBusyThread);
    return this._threadPort.get(lessBusyThread);
  }
  getAmountSafe(thread) {
    const amount = this.getAmount(thread);
    if (!amount) {
      throw new Error(`Fragments: Amount for thread ${thread} not found`);
    }
    return amount;
  }
  setPort(thread, port) {
    this._threadPort.set(thread, port);
  }
  setAmount(thread, amount) {
    this._threadsModelAmount.set(thread, amount);
  }
  getPort(thread) {
    return this._threadPort.get(thread);
  }
}
export {
  ThreadsData
};
//# sourceMappingURL=threads-data.mjs.map
