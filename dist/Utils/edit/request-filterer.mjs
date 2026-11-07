import { EditRequestType } from "./edit-types.mjs";
function applyChangesToRawData(actions, rawData, type, filter) {
  const createType = EditRequestType[`CREATE_${type}`];
  const updateType = EditRequestType[`UPDATE_${type}`];
  const deleteType = EditRequestType[`DELETE_${type}`];
  if (actions) {
    for (const action of actions) {
      if (action.type === createType || action.type === updateType) {
        if (filter && !filter.has(action.localId)) {
          continue;
        }
        rawData.set(action.localId, action.data);
        continue;
      }
      if (action.type === deleteType) {
        rawData.delete(action.localId);
      }
    }
  }
}
function applyChangesToSpecialData(actions, key) {
  const updateType = EditRequestType[`UPDATE_${key}`];
  if (actions) {
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      if (action.type === updateType) {
        return JSON.parse(JSON.stringify(action.data));
      }
    }
  }
  return null;
}
function applyChangesToIds(actions, ids, key, addCreatedElements) {
  const resultSet = new Set(ids);
  const deleteType = EditRequestType[`DELETE_${key}`];
  const createType = EditRequestType[`CREATE_${key}`];
  for (const action of actions) {
    if (action.type === deleteType) {
      resultSet.delete(action.localId);
      continue;
    }
    if (addCreatedElements && action.type === createType) {
      resultSet.add(action.localId);
    }
  }
  return Array.from(resultSet);
}
export {
  applyChangesToIds,
  applyChangesToRawData,
  applyChangesToSpecialData
};
//# sourceMappingURL=request-filterer.mjs.map
