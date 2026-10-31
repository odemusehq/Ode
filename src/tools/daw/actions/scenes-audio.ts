import { z } from "zod";
import { t } from "../../../shared/i18n";
import { extensionTool } from "../extension-tool";
import { SceneRefSchema } from "../schemas";

export const sceneTools = [
  extensionTool({
    op: "scene_rename",
    changes: "set",
    description: "Rename a scene.",
    input: { scene: SceneRefSchema, name: z.string().min(1) },
    describe: ({ scene, name }, names) => t("toolActivity.renameScene", { scene: names.scene(scene), name: name }),
  })
];
