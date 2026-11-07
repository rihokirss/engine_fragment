class SectionManager {
  async getSection(model, plane, localIds) {
    const args = [plane, localIds];
    const result = await model._invoke("getSection", args);
    return result;
  }
}
export {
  SectionManager
};
//# sourceMappingURL=section-manager.mjs.map
