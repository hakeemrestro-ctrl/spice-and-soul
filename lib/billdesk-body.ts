import 'server-only';

// Cancel the underlying reader on deadline/disconnect, not just the waiting promise.
export async function readBilldeskBody(req: Request, max = 262144, timeout = 10000): Promise<string> {
  const encoding = req.headers.get('content-encoding');
  if (encoding && encoding !== 'identity') throw new Error('Unsupported body encoding');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let rejectAbort: (e: Error) => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    rejectAbort(new Error('Body read cancelled'));
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(abort, timeout);
  req.signal.addEventListener('abort', abort, { once: true });
  try {
    if (req.signal.aborted) abort();
    while (true) {
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error('Body too large');
      chunks.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    clearTimeout(timer); req.signal.removeEventListener('abort', abort);
    void reader.cancel().catch(() => {}); reader.releaseLock();
  }
}
