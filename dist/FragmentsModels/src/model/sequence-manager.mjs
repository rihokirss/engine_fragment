class SequenceManager {
  async getSequenced(model, result, fromItems, inputs) {
    const args = [result, fromItems, inputs];
    const response = await model._invoke("getSequenced", args);
    return response;
  }
}
export {
  SequenceManager
};
//# sourceMappingURL=sequence-manager.mjs.map
