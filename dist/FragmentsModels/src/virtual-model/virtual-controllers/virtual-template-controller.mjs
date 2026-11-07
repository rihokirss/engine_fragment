class VirtualTemplateController {
  _templates = /* @__PURE__ */ new Map();
  add(code, template) {
    this._templates.set(code, template);
  }
  get(code) {
    const templates = this._templates.get(code);
    if (!Array.isArray(templates)) {
      return { ...templates };
    }
    return this.getTemplateSet(templates);
  }
  getTemplateSet(templates) {
    const result = [];
    for (const template of templates) {
      const tileData = template;
      const copy = { ...tileData };
      result.push(copy);
    }
    return result;
  }
}
export {
  VirtualTemplateController
};
//# sourceMappingURL=virtual-template-controller.mjs.map
