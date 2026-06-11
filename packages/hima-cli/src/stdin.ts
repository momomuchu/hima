// Read JSON from stdin with a timeout and size limit.

const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 5000;

export async function readJsonStdin(): Promise<unknown> {
  if (process.stdin.isTTY) return {};

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    process.stdin.destroy(new Error("Timed out reading hook stdin."));
  }, TIMEOUT_MS);
  timeout.unref();

  try {
    for await (const chunk of process.stdin) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      totalBytes += buf.length;
      if (totalBytes > MAX_BYTES) throw new Error(`Hook stdin exceeds ${MAX_BYTES} bytes.`);
      chunks.push(buf);
    }
  } catch (err) {
    if (timedOut) throw new Error(`Timed out reading hook stdin after ${TIMEOUT_MS}ms.`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw.length === 0 ? {} : JSON.parse(raw);
}
