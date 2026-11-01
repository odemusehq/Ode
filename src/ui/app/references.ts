import { t } from "../../shared/i18n";
import { REFERENCE_LIMITS } from "../../shared/composer";

export const REFERENCE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.xml,.srt,.lrc,.wav,.wave,.mp3";
export interface ReferenceSelection { files: { file: File; path: string }[]; folder?: string }

export function selectedReferences(files: Iterable<File>): ReferenceSelection[] {
  const items = Array.from(files).filter(file => !(file.webkitRelativePath || file.name).split("/").some(part => part.startsWith(".") || ["node_modules", "vendor"].includes(part)));
  if (items.some(file => file.webkitRelativePath)) return [{ folder: items[0]!.webkitRelativePath.split("/")[0], files: items.map(file => ({ file, path: file.webkitRelativePath || file.name })) }];
  return items.map(file => ({ files: [{ file, path: file.name }] }));
}

/** Directory readers return batches. Keep paths for browsing without flattening them into a prompt. */
export async function droppedReferences(transfer: DataTransfer): Promise<ReferenceSelection[]> {
  const entries = Array.from(transfer.items).filter(item => item.kind === "file").map(item => item.webkitGetAsEntry?.());
  if (!entries.length || entries.some(entry => !entry)) return selectedReferences(Array.from(transfer.files));
  const selections: ReferenceSelection[] = [];
  for (const root of entries) {
    const files: ReferenceSelection["files"] = [];
    let seen = 0;
    const visit = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
      if (entry.name.startsWith(".") || ["node_modules", "vendor"].includes(entry.name)) return;
      if (++seen > 512 || files.length >= REFERENCE_LIMITS.files) throw new Error(t("references.tooLarge"));
      const path = prefix + entry.name;
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        files.push({ file, path });
      } else {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        for (;;) {
          const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
          if (!batch.length) break;
          for (const child of batch) await visit(child, path + "/");
        }
      }
    };
    await visit(root!, "");
    if (files.length) selections.push({ files, ...(root!.isDirectory ? { folder: root!.name } : {}) });
  }
  return selections;
}
