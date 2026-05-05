import { mkdir, rmdir, stat } from "node:fs/promises";

const LOCK_TIMEOUT_MS = 4000;
const LOCK_RETRY_MS = 50;
const STALE_LOCK_MS = 10000;

export async function withFileLock<T>(lockDir: string, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await mkdir(lockDir);
      break;
    } catch (error: unknown) {
      if (!isEexist(error)) {
        throw error;
      }

      if (await isStaleLock(lockDir)) {
        await rmdir(lockDir).catch(() => {});
        continue;
      }

      await sleep(LOCK_RETRY_MS);
    }
  }

  if (Date.now() >= deadline) {
    await rmdir(lockDir).catch(() => {});
    await mkdir(lockDir);
  }

  try {
    return await fn();
  } finally {
    await rmdir(lockDir).catch(() => {});
  }
}

function isEexist(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "EEXIST"
  );
}

async function isStaleLock(lockDir: string): Promise<boolean> {
  try {
    const stats = await stat(lockDir);
    return Date.now() - stats.mtimeMs > STALE_LOCK_MS;
  } catch {
    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
