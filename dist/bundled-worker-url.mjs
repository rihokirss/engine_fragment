function getBundledWorkerUrl() {
  return new URL("./Worker/worker.mjs", import.meta.url).href;
}
export {
  getBundledWorkerUrl
};
//# sourceMappingURL=bundled-worker-url.mjs.map
