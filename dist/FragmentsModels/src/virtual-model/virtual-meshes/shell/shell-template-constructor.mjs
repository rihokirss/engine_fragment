import { ObjectClass, limitOf2Bytes } from "../../../model/model-types.mjs";
import { ShellUtils } from "./shell-utils.mjs";
import { ShellHole } from "../../../../../Schema/shell-hole.mjs";
import { BigShellHole } from "../../../../../Schema/big-shell-hole.mjs";
import { ShellProfile } from "../../../../../Schema/shell-profile.mjs";
import { BigShellProfile } from "../../../../../Schema/big-shell-profile.mjs";
import { ShellType } from "../../../../../Schema/shell-type.mjs";
class ShellTemplateConstructor {
  _shellHole = new ShellHole();
  _bigShellHole = new BigShellHole();
  holePoints = 0;
  profilePoints = 0;
  triangleAmount = 0;
  indexCount = 0;
  meshes = [];
  _shellProfile = new ShellProfile();
  _bigShellProfile = new BigShellProfile();
  newMeshTemplate(shell) {
    const isEmpty = this.getIsEmpty(shell);
    if (isEmpty) {
      return { objectClass: ObjectClass.SHELL };
    }
    this.reset(true);
    this.processShell(shell);
    return this.getResult();
  }
  manageDataLeft() {
    const isDataLeft = this.getIsDataLeft();
    if (isDataLeft) {
      this.setMesh();
    }
  }
  getIsEmpty(shell) {
    const length = ShellUtils.getProfilesLength(shell);
    return length === 0;
  }
  processShellHoles(shell, id) {
    let shellHolesExist = false;
    const count = ShellUtils.getHolesLength(shell);
    const hole = this.getTempHole(shell);
    for (let i = 0; i < count; i++) {
      ShellUtils.getHole(shell, i, hole);
      const profileId = hole.profileId();
      if (profileId !== id) continue;
      this.updateBuffers(shell, shellHolesExist);
      shellHolesExist = true;
    }
    this.manageFoundHoles(shell, shellHolesExist);
  }
  newMesh() {
    return {
      objectClass: ObjectClass.SHELL,
      indexCount: this.triangleAmount * 3,
      positionCount: (this.holePoints + this.profilePoints) * 3,
      normalCount: (this.holePoints + this.profilePoints) * 3
    };
  }
  reset(evenMeshes) {
    this.holePoints = 0;
    this.profilePoints = 0;
    this.triangleAmount = 0;
    if (evenMeshes) {
      this.meshes = void 0;
    }
  }
  getIsDataLeft() {
    const areTriangles = this.triangleAmount > 0;
    const areHoles = this.holePoints > 0;
    const areProfiles = this.profilePoints > 0;
    return areTriangles || areHoles || areProfiles;
  }
  processShell(shell) {
    const count = ShellUtils.getProfilesLength(shell);
    const profile = this.getTempProfile(shell);
    for (let id = 0; id < count; id++) {
      ShellUtils.getProfile(shell, id, profile);
      this.indexCount = profile.indicesLength();
      this.profilePoints += this.indexCount;
      this.processShellHoles(shell, id);
      this.manageMemory();
    }
    this.manageDataLeft();
  }
  manageFoundHoles(shell, shellHolesExist) {
    const profile = this.getTempProfile(shell);
    const indicesAmount = profile.indicesLength();
    if (shellHolesExist) {
      this.triangleAmount += indicesAmount;
      return;
    }
    if (indicesAmount > 2) {
      this.triangleAmount += indicesAmount - 2;
    }
  }
  getResult() {
    const meshes = this.meshes;
    this.meshes = void 0;
    return meshes;
  }
  manageMemory() {
    const memory = this.holePoints + this.profilePoints + this.indexCount;
    const memoryOverflow = memory > limitOf2Bytes;
    if (memoryOverflow) {
      this.setMesh();
    }
  }
  updateBuffers(shell, shellHolesExist) {
    const hole = this.getTempHole(shell);
    this.holePoints += hole.indicesLength();
    this.triangleAmount += hole.indicesLength();
    if (shellHolesExist) {
      this.triangleAmount += 2;
    }
  }
  setMesh() {
    const mesh = this.newMesh();
    if (!this.meshes) {
      this.meshes = mesh;
    } else if (Array.isArray(this.meshes)) {
      this.meshes.push(mesh);
    } else {
      this.meshes = [this.meshes, mesh];
    }
    this.reset(false);
  }
  getTempProfile(shell) {
    if (shell.type() === ShellType.BIG) {
      return this._bigShellProfile;
    }
    return this._shellProfile;
  }
  getTempHole(shell) {
    if (shell.type() === ShellType.BIG) {
      return this._bigShellHole;
    }
    return this._shellHole;
  }
}
export {
  ShellTemplateConstructor
};
//# sourceMappingURL=shell-template-constructor.mjs.map
