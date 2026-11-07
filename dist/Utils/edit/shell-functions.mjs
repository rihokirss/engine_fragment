import { copyFloatVector } from "./misc-functions.mjs";
import { Shell } from "../../Schema/shell.mjs";
import { FloatVector } from "../../Schema/float-vector.mjs";
import { ShellProfile } from "../../Schema/shell-profile.mjs";
import { ShellHole } from "../../Schema/shell-hole.mjs";
import { BigShellProfile } from "../../Schema/big-shell-profile.mjs";
import { BigShellHole } from "../../Schema/big-shell-hole.mjs";
function createShell(builder, shell) {
  const shellType = shell.type;
  const profiles = [];
  const holes = [];
  const bigProfiles = [];
  const bigHoles = [];
  const pointsLength = shell.points.length;
  Shell.startPointsVector(builder, pointsLength);
  for (let i = 0; i < pointsLength; i++) {
    const j = pointsLength - 1 - i;
    const currentPoint = shell.points[j];
    FloatVector.createFloatVector(
      builder,
      currentPoint[0],
      currentPoint[1],
      currentPoint[2]
    );
  }
  const pointsOffset = builder.endVector();
  for (const [, current] of shell.profiles) {
    const indicesOffset = ShellProfile.createIndicesVector(
      builder,
      current
    );
    const profileOffset = ShellProfile.createShellProfile(
      builder,
      indicesOffset
    );
    profiles.push(profileOffset);
  }
  const shellProfilesOffset = Shell.createProfilesVector(builder, profiles);
  for (const [profileId, currents] of shell.holes) {
    for (const current of currents) {
      const indicesOffset = ShellHole.createIndicesVector(builder, current);
      const holeOffset = ShellHole.createShellHole(
        builder,
        indicesOffset,
        profileId
      );
      holes.push(holeOffset);
    }
  }
  const shellHolesOffset = Shell.createHolesVector(builder, holes);
  for (const [, current] of shell.bigProfiles) {
    const bigIndicesOffset = BigShellProfile.createIndicesVector(
      builder,
      current
    );
    const bigProfileOffset = BigShellProfile.createBigShellProfile(
      builder,
      bigIndicesOffset
    );
    bigProfiles.push(bigProfileOffset);
  }
  const bigShellProfilesOffset = Shell.createBigProfilesVector(
    builder,
    bigProfiles
  );
  for (const [profileId, currents] of shell.bigHoles) {
    for (const current of currents) {
      const bigIndicesOffset = BigShellHole.createIndicesVector(
        builder,
        current
      );
      const bigHoleOffset = BigShellHole.createBigShellHole(
        builder,
        bigIndicesOffset,
        profileId
      );
      bigHoles.push(bigHoleOffset);
    }
  }
  const bigShellHolesOffset = Shell.createBigHolesVector(builder, bigHoles);
  const shellFaceIdsOffset = Shell.createProfilesFaceIdsVector(
    builder,
    shell.profilesFaceIds
  );
  const shellOffset = Shell.createShell(
    builder,
    shellProfilesOffset,
    shellHolesOffset,
    pointsOffset,
    bigShellProfilesOffset,
    bigShellHolesOffset,
    shellType,
    shellFaceIdsOffset
  );
  return shellOffset;
}
function copyShell(builder, shell) {
  const shellType = shell.type();
  const profiles = [];
  const holes = [];
  const bigProfiles = [];
  const bigHoles = [];
  const pointsLength = shell.pointsLength();
  Shell.startPointsVector(builder, pointsLength);
  for (let i = 0; i < pointsLength; i++) {
    const j = pointsLength - 1 - i;
    const currentPoint = shell.points(j);
    copyFloatVector(builder, currentPoint);
  }
  const pointsOffset = builder.endVector();
  const profilesLength = shell.profilesLength();
  for (let i = 0; i < profilesLength; i++) {
    const current = shell.profiles(i);
    const indices = current.indicesArray();
    const indicesOffset = ShellProfile.createIndicesVector(
      builder,
      indices
    );
    const profileOffset = ShellProfile.createShellProfile(
      builder,
      indicesOffset
    );
    profiles.push(profileOffset);
  }
  const shellProfilesOffset = Shell.createProfilesVector(builder, profiles);
  const holesLength = shell.holesLength();
  for (let i = 0; i < holesLength; i++) {
    const current = shell.holes(i);
    const indices = current.indicesArray();
    const profileId = current.profileId();
    const indicesOffset = ShellHole.createIndicesVector(builder, indices);
    const holeOffset = ShellHole.createShellHole(
      builder,
      indicesOffset,
      profileId
    );
    holes.push(holeOffset);
  }
  const shellHolesOffset = Shell.createHolesVector(builder, holes);
  const bigProfilesLength = shell.bigProfilesLength();
  for (let i = 0; i < bigProfilesLength; i++) {
    const current = shell.bigProfiles(i);
    const indices = current.indicesArray();
    const indicesOffset = BigShellProfile.createIndicesVector(
      builder,
      indices
    );
    const bigProfileOffset = BigShellProfile.createBigShellProfile(
      builder,
      indicesOffset
    );
    bigProfiles.push(bigProfileOffset);
  }
  const bigShellProfilesOffset = Shell.createBigProfilesVector(
    builder,
    bigProfiles
  );
  const bigHolesLength = shell.bigHolesLength();
  for (let i = 0; i < bigHolesLength; i++) {
    const current = shell.bigHoles(i);
    const indices = current.indicesArray();
    const profileId = current.profileId();
    const indicesOffset = BigShellHole.createIndicesVector(
      builder,
      indices
    );
    const bigHoleOffset = BigShellHole.createBigShellHole(
      builder,
      indicesOffset,
      profileId
    );
    bigHoles.push(bigHoleOffset);
  }
  const bigShellHolesOffset = Shell.createBigHolesVector(builder, bigHoles);
  const shellFaceIdsOffset = Shell.createProfilesFaceIdsVector(
    builder,
    shell.profilesFaceIdsArray() || []
  );
  const shellOffset = Shell.createShell(
    builder,
    shellProfilesOffset,
    shellHolesOffset,
    pointsOffset,
    bigShellProfilesOffset,
    bigShellHolesOffset,
    shellType,
    shellFaceIdsOffset
  );
  return shellOffset;
}
export {
  copyShell,
  createShell
};
//# sourceMappingURL=shell-functions.mjs.map
