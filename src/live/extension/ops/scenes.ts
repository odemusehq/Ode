import { OperationGroup } from "./group";
import { OperationKind, type OpArgs, type OpRun, type OperationTable } from "./operation";

type SceneOp = "scene_get" | "scene_rename";

/** Scenes in Session View. */
export class SceneOperations extends OperationGroup<SceneOp> {
  table(): OperationTable<SceneOp> {
    return {
      scene_get: { kind: OperationKind.Read, prepare: (args) => this.get(args) },
      scene_rename: { kind: OperationKind.Change, prepare: (args) => this.rename(args) },
    };
  }

  private get({ scene }: OpArgs<"scene_get">): OpRun<"scene_get"> {
    const found = this.refs.scene(scene);
    return async () => this.describe.scene(found.scene, found.index);
  }

  private rename({ scene, name }: OpArgs<"scene_rename">): OpRun<"scene_rename"> {
    const found = this.refs.scene(scene);
    return async () => {
      found.scene.name = name;
      return this.describe.scene(found.scene, found.index);
    };
  }
}
