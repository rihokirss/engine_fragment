import { CircleExtrusion } from "../../Schema/circle-extrusion.mjs";
import { Axis } from "../../Schema/axis.mjs";
import { CircleCurve } from "../../Schema/circle-curve.mjs";
import { Wire } from "../../Schema/wire.mjs";
import { WireSet } from "../../Schema/wire-set.mjs";
import { FloatVector } from "../../Schema/float-vector.mjs";
function copyCircleExtrusion(builder, current) {
  const radiuses = current.radiusArray();
  const radiusRef = CircleExtrusion.createRadiusVector(builder, radiuses);
  const axesLength = current.axesLength();
  const axesOffsets = [];
  for (let j = 0; j < axesLength; j++) {
    const currentAxis = current.axes(j);
    const circleCurvesLength = currentAxis.circleCurvesLength();
    Axis.startCircleCurvesVector(builder, circleCurvesLength);
    for (let k = 0; k < circleCurvesLength; k++) {
      const h = circleCurvesLength - 1 - k;
      const currentCc = currentAxis.circleCurves(h);
      const position = currentCc.position();
      const radius = currentCc.radius();
      const aperture = currentCc.aperture();
      const xDir = currentCc.xDirection();
      const yDir = currentCc.yDirection();
      const px = position.x();
      const py = position.y();
      const pz = position.z();
      const dxx = xDir.x();
      const dxy = xDir.y();
      const dxz = xDir.z();
      const dyx = yDir.x();
      const dyy = yDir.y();
      const dyz = yDir.z();
      CircleCurve.createCircleCurve(
        builder,
        aperture,
        px,
        py,
        pz,
        radius,
        dxx,
        dxy,
        dxz,
        dyx,
        dyy,
        dyz
      );
    }
    const circleCurvesOffset = builder.endVector();
    const wiresLength = currentAxis.wiresLength();
    Axis.startWiresVector(builder, wiresLength);
    for (let k = 0; k < wiresLength; k++) {
      const h = wiresLength - 1 - k;
      const currentWire = currentAxis.wires(h);
      const p1 = currentWire.p1();
      const p2 = currentWire.p2();
      Wire.createWire(
        builder,
        p1.x(),
        p1.y(),
        p1.z(),
        p2.x(),
        p2.y(),
        p2.z()
      );
    }
    const wiresOffset = builder.endVector();
    Axis.startWireSetsVector(builder, 0);
    const wireSetOffset = builder.endVector();
    const ordersArray = currentAxis.orderArray();
    const ordersOffset = Axis.createOrderVector(builder, ordersArray);
    const partsArray = Array.from(currentAxis.partsArray());
    const axisPartsOffset = Axis.createPartsVector(builder, partsArray);
    Axis.startAxis(builder);
    Axis.addCircleCurves(builder, circleCurvesOffset);
    Axis.addOrder(builder, ordersOffset);
    Axis.addWires(builder, wiresOffset);
    Axis.addWireSets(builder, wireSetOffset);
    Axis.addParts(builder, axisPartsOffset);
    const axisOffset = Axis.endAxis(builder);
    axesOffsets.push(axisOffset);
  }
  const axesRef = CircleExtrusion.createAxesVector(builder, axesOffsets);
  CircleExtrusion.startCircleExtrusion(builder);
  CircleExtrusion.addAxes(builder, axesRef);
  CircleExtrusion.addRadius(builder, radiusRef);
  const ceOffset = CircleExtrusion.endCircleExtrusion(builder);
  return ceOffset;
}
function createCircleExtrusion(builder, circleExtrusion) {
  const radiuses = circleExtrusion.radius;
  const radiusRef = CircleExtrusion.createRadiusVector(builder, radiuses);
  const axesOffsets = [];
  for (const axis of circleExtrusion.axes) {
    const circleCurvesLength = axis.circleCurves.length;
    Axis.startCircleCurvesVector(builder, circleCurvesLength);
    for (const circleCurve of axis.circleCurves) {
      CircleCurve.createCircleCurve(
        builder,
        circleCurve.aperture,
        circleCurve.position[0],
        circleCurve.position[1],
        circleCurve.position[2],
        circleCurve.radius,
        circleCurve.xDirection[0],
        circleCurve.xDirection[1],
        circleCurve.xDirection[2],
        circleCurve.yDirection[0],
        circleCurve.yDirection[1],
        circleCurve.yDirection[2]
      );
    }
    const circleCurvesOffset = builder.endVector();
    const wiresLength = axis.wires.length;
    Axis.startWiresVector(builder, wiresLength);
    for (const wire of axis.wires) {
      Wire.createWire(
        builder,
        wire[0],
        wire[1],
        wire[2],
        wire[3],
        wire[4],
        wire[5]
      );
    }
    const wiresOffset = builder.endVector();
    const allWireSetsOffsets = [];
    for (const wireSet of axis.wireSets) {
      WireSet.startPsVector(builder, wireSet.length / 3);
      for (let i = 0; i < wireSet.length - 2; i += 3) {
        FloatVector.createFloatVector(
          builder,
          wireSet[i],
          wireSet[i + 1],
          wireSet[i + 2]
        );
      }
      const psOffset = builder.endVector();
      WireSet.startWireSet(builder);
      WireSet.addPs(builder, psOffset);
      const wireSetOffset2 = WireSet.endWireSet(builder);
      allWireSetsOffsets.push(wireSetOffset2);
    }
    const wireSetOffset = Axis.createWireSetsVector(
      builder,
      allWireSetsOffsets
    );
    const ordersOffset = Axis.createOrderVector(builder, axis.order);
    const axisPartsOffset = Axis.createPartsVector(builder, axis.parts);
    Axis.startAxis(builder);
    Axis.addCircleCurves(builder, circleCurvesOffset);
    Axis.addOrder(builder, ordersOffset);
    Axis.addWires(builder, wiresOffset);
    Axis.addWireSets(builder, wireSetOffset);
    Axis.addParts(builder, axisPartsOffset);
    const axisOffset = Axis.endAxis(builder);
    axesOffsets.push(axisOffset);
  }
  const axesRef = CircleExtrusion.createAxesVector(builder, axesOffsets);
  CircleExtrusion.startCircleExtrusion(builder);
  CircleExtrusion.addAxes(builder, axesRef);
  CircleExtrusion.addRadius(builder, radiusRef);
  const ceOffset = CircleExtrusion.endCircleExtrusion(builder);
  return ceOffset;
}
export {
  copyCircleExtrusion,
  createCircleExtrusion
};
//# sourceMappingURL=circle-extrusion-functions.mjs.map
