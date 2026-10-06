import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNative } from "./platform";
import { exportData, useSupplime } from "./store";
import { todayKey } from "./utils";

/**
 * Everything lives on the phone, so a backup file is the safety net for a new phone
 * or a reinstall. On Android it opens the share sheet (Drive, email, Files…).
 */
export async function exportBackup() {
  const json = JSON.stringify(
    { app: "supplime", version: 2, exportedAt: new Date().toISOString(), state: exportData() },
    null,
    2,
  );
  const name = `supplime-backup-${todayKey()}.json`;
  if (isNative()) {
    const file = await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "Supplime backup",
      files: [file.uri],
      dialogTitle: "Save your Supplime backup",
    });
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<boolean> {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    return useSupplime.getState().importData(parsed);
  } catch {
    return false;
  }
}
