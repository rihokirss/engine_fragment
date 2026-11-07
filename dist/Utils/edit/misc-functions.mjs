import { FloatVector } from "../../Schema/float-vector.mjs";
function copyFloatVector(builder, vector) {
  return FloatVector.createFloatVector(
    builder,
    vector.x(),
    vector.y(),
    vector.z()
  );
}
export {
  copyFloatVector
};
//# sourceMappingURL=misc-functions.mjs.map
