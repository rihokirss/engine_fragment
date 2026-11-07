class SequenceHelper {
  _model;
  constructor(model) {
    this._model = model;
  }
  getSequenced(result, fromItems, inputs) {
    const resultFunction = this.sequenceResultFunction[result];
    if (!resultFunction) return null;
    let partial = [];
    let iterations = 0;
    for (const action of fromItems) {
      const selectorFunction = this.sequenceSelectorFunction[action];
      if (!selectorFunction) continue;
      const input2 = inputs?.selector?.[action];
      const data = iterations === 0 ? input2 : partial;
      partial = selectorFunction(data);
      iterations++;
    }
    const input = inputs?.result;
    const out = resultFunction(partial, input);
    return out;
  }
  sequenceSelectorFunction = {
    withVisiblity: (_) => this._model.getItemsByVisibility(_),
    highlighted: () => this._model.getHighlightItemIds(),
    children: (_) => this._model.getItemsChildren(_),
    ofCategory: (_) => {
      const categoryIds = this._model.getItemsOfCategories(_);
      return Object.values(categoryIds).flat();
    },
    withCondition: () => [],
    withGeometry: () => this._model.getItemsWithGeometry()
  };
  sequenceResultFunction = {
    attributes: (ids) => ids.map((id) => this._model.getItemAttributes(id)),
    mergedBoxes: (_) => this._model.getBBoxes(_),
    category: (ids) => this._model.getItemsCategories(ids),
    children: (_) => this._model.getItemsChildren(_),
    data: (ids, ...args) => this._model.getItemsData(ids, args[0]),
    geometry: (ids) => this._model.getItemsGeometry(ids),
    guid: (_) => this._model.getGuidsByLocalIds(_),
    highlight: (_) => this._model.getHighlight(_),
    relations: (ids) => ids.map((id) => this._model.getItemRelations(id)),
    visibility: (_) => this._model.getVisible(_)
  };
}
export {
  SequenceHelper
};
//# sourceMappingURL=sequence-helper.mjs.map
