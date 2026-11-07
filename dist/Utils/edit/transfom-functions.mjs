import { Transform } from "../../Schema/transform.mjs";
function createTransform(transform, builder) {
  const meshesPos = transform.position;
  const meshesDx = transform.xDirection;
  const meshesDy = transform.yDirection;
  const coordinatesOffset = Transform.createTransform(
    builder,
    meshesPos[0],
    meshesPos[1],
    meshesPos[2],
    meshesDx[0],
    meshesDx[1],
    meshesDx[2],
    meshesDy[0],
    meshesDy[1],
    meshesDy[2]
  );
  return coordinatesOffset;
}
function copyTransform(builder, transform) {
  const meshesPos = transform.position();
  const meshesDx = transform.xDirection();
  const meshesDy = transform.yDirection();
  const coordinatesOffset = Transform.createTransform(
    builder,
    meshesPos.x(),
    meshesPos.y(),
    meshesPos.z(),
    meshesDx.x(),
    meshesDx.y(),
    meshesDx.z(),
    meshesDy.x(),
    meshesDy.y(),
    meshesDy.z()
  );
  return coordinatesOffset;
}
export {
  copyTransform,
  createTransform
};
//# sourceMappingURL=transfom-functions.mjs.map
