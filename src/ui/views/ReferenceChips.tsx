import { t } from "../../shared/i18n";
import { API } from "../../shared/api";
import type { ComposerAttachment } from "../../shared/composer";
import { IconButton, IconName } from "../../ui-kit";

export function ReferenceChips({ files, remove }: { files: readonly ComposerAttachment[]; remove?: (id: string) => void }) {
  if (!files.length) return null;
  return <ul className="now__attachments" aria-label={t("references.attached")}>
    {files.map(file => <li key={file.entryId} title={file.name}>
      {file.kind === "image" && <img src={`${API.referenceImage}/${file.id}`} alt="" loading="lazy" />}
      <span>{file.name}</span>
      {remove && <IconButton icon={IconName.Close} label={t("references.remove", { name: file.name })} onClick={() => remove(file.entryId)} />}
    </li>)}
  </ul>;
}
