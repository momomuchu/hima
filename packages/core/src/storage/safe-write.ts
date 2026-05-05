import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export async function safeAtomicWriteFile(
  root: string,
  targetPath: string,
  content: string,
): Promise<void> {
  const resolvedTarget = path.resolve(targetPath);
  const targetDirectory = path.dirname(resolvedTarget);

  await assertSafeWriteTarget(root, resolvedTarget);
  const directoryBeforeWrite = await lstat(targetDirectory);
  const tempPath = path.join(
    targetDirectory,
    `.${path.basename(resolvedTarget)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await assertSafeWriteTarget(root, resolvedTarget);
    await assertDirectoryIdentityUnchanged(
      targetDirectory,
      directoryBeforeWrite,
      "before renaming temporary write target",
    );
    await rename(tempPath, resolvedTarget);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export async function safeUnlinkFile(root: string, targetPath: string): Promise<void> {
  await assertSafeDeleteTarget(root, targetPath);
  await unlink(path.resolve(targetPath));
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

export async function assertSafeDeleteTarget(root: string, targetPath: string): Promise<void> {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);

  const rootStat = await lstat(resolvedRoot);
  if (rootStat.isSymbolicLink()) {
    throw new Error(`Refusing to delete through symlinked root: ${resolvedRoot}`);
  }

  const realRoot = await realpath(resolvedRoot);
  const targetDirectory = path.dirname(resolvedTarget);

  assertResolvedPathInsideRoot(resolvedRoot, resolvedTarget, "Delete target");
  await assertNoExistingSymlinkParents(resolvedRoot, targetDirectory, realRoot, "delete");

  const realTargetDirectory = await realpath(targetDirectory);
  assertResolvedPathInsideRoot(realRoot, realTargetDirectory, "Delete target directory");

  const targetStat = await lstat(resolvedTarget);
  if (targetStat.isSymbolicLink()) {
    throw new Error(`Refusing to delete symlinked target: ${resolvedTarget}`);
  }

  if (!targetStat.isFile()) {
    throw new Error(`Refusing to delete non-file target: ${resolvedTarget}`);
  }

  if (targetStat.nlink > 1) {
    throw new Error(`Refusing to delete hardlinked target: ${resolvedTarget}`);
  }
}

async function assertNoExistingSymlinkParents(
  root: string,
  targetDirectory: string,
  realRoot: string,
  operation = "write",
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
      throw new Error(`Refusing to ${operation} through symlinked parent: ${currentPath}`);
    }

    if (stat.isDirectory()) {
      assertResolvedPathInsideRoot(
        realRoot,
        await realpath(currentPath),
        `${capitalize(operation)} target parent`,
      );
    }
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
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

async function assertDirectoryIdentityUnchanged(
  targetDirectory: string,
  expected: Awaited<ReturnType<typeof lstat>>,
  context: string,
): Promise<void> {
  const actual = await lstat(targetDirectory);

  if (actual.dev !== expected.dev || actual.ino !== expected.ino) {
    throw new Error(`Refusing to write because target directory identity changed ${context}.`);
  }
}
