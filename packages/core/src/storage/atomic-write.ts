import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function atomicWriteFile(targetPath: string, content: string): Promise<void> {
  const directory = path.dirname(targetPath);
  await mkdir(directory, { recursive: true });

  const tempPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, targetPath);
}
