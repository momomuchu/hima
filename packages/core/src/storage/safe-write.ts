import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "./atomic-write.js";

export async function safeAtomicWriteFile(
  root: string,
  targetPath: string,
  content: string,
): Promise<void> {
  await assertSafeWriteTarget(root, targetPath);
  await atomicWriteFile(targetPath, content);
}

export async function assertSafeWriteTarget(root: string, targetPath: string): Promise<void> {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);

  await mkdir(resolvedRoot, { recursive: true });
  const rootStat = await lstat(resolvedRoot);
  if (rootStat.isSymbolicLink()) {
    throw new Error(`Refusing to write through symlinked root: ${resolvedRoot}`);
  }

  const realRoot = await realpath(resolvedRoot);
  const targetDirectory = path.dirname(resolvedTarget);

  assertResolvedPathInsideRoot(resolvedRoot, resolvedTarget, "Write target");
  await assertNoExistingSymlinkParents(resolvedRoot, targetDirectory, realRoot);
  await mkdir(targetDirectory, { recursive: true });

  const realTargetDirectory = await realpath(targetDirectory);
  assertResolvedPathInsideRoot(realRoot, realTargetDirectory, "Write target directory");

  const targetStat = await safeLstat(resolvedTarget);
  if (targetStat?.isSymbolicLink()) {
    throw new Error(`Refusing to write through symlinked target: ${resolvedTarget}`);
  }

  if (targetStat !== undefined && targetStat.nlink > 1) {
    throw new Error(`Refusing to write through hardlinked target: ${resolvedTarget}`);
  }
}

async function assertNoExistingSymlinkParents(
  root: string,
  targetDirectory: string,
  realRoot: string,
): Promise<void> {
  let currentPath = path.resolve(root);
  const relativeDirectory = path.relative(currentPath, targetDirectory);
  const segments = relativeDirectory
    .split(path.sep)
    .filter((segment) => segment.length > 0 && segment !== ".");

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    const stat = await safeLstat(currentPath);

    if (stat === undefined) {
      return;
    }

    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to write through symlinked parent: ${currentPath}`);
    }

    if (stat.isDirectory()) {
      assertResolvedPathInsideRoot(realRoot, await realpath(currentPath), "Write target parent");
    }
  }
}

function assertResolvedPathInsideRoot(root: string, targetPath: string, label: string): void {
  const relativeTarget = path.relative(root, targetPath);

  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error(`${label} must stay inside the write root.`);
  }
}

async function safeLstat(
  targetPath: string,
): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    throw error;
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
