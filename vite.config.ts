import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ARTIFACTS_DIR_NAME = 'Артефакты';
const ARTIFACT_TRASH_DIR_NAME = '.deleted';
const ARTIFACT_API_PREFIX = '/api/artifacts/files';
const MAX_ARTIFACT_REQUEST_BYTES = 250 * 1024 * 1024;

const mimeByExtension: Record<string, string> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.csv': 'text/csv; charset=utf-8',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};
const inlinePreviewExtensions = new Set(['.apng', '.avif', '.csv', '.gif', '.jpg', '.jpeg', '.json', '.log', '.md', '.pdf', '.png', '.svg', '.txt', '.webp']);

const contentTypeForFile = (fileName: string) => mimeByExtension[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
const contentDispositionForFile = (fileName: string) => `${inlinePreviewExtensions.has(path.extname(fileName).toLowerCase()) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
const artifactUrl = (fileName: string) => `${ARTIFACT_API_PREFIX}/${encodeURIComponent(fileName)}`;
const sanitizeSegment = (value: unknown, fallback: string) => {
  const clean = String(value ?? '')
    .normalize('NFC')
    .replace(/[\\/?%*:|"<>]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return clean || fallback;
};

const sendJson = (res: any, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req: any) => new Promise<any>((resolve, reject) => {
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_ARTIFACT_REQUEST_BYTES) {
      tooLarge = true;
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) {
      reject(Object.assign(new Error('Artifact request is too large'), { statusCode: 413 }));
      return;
    }
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
    }
  });
  req.on('error', reject);
});

const safeArtifactPath = (artifactsDir: string, fileName: string) => {
  const baseName = path.basename(fileName);
  if (!baseName || baseName !== fileName || baseName === '.' || baseName === '..') throw Object.assign(new Error('Bad artifact file name'), { statusCode: 400 });
  const resolvedDir = path.resolve(artifactsDir);
  const filePath = path.resolve(resolvedDir, baseName);
  if (!filePath.startsWith(`${resolvedDir}${path.sep}`)) throw Object.assign(new Error('Bad artifact file path'), { statusCode: 400 });
  return filePath;
};
const safeTrashArtifactPath = (artifactsDir: string, fileName: string) => safeArtifactPath(path.join(artifactsDir, ARTIFACT_TRASH_DIR_NAME), fileName);

const decodeDataUrl = (value: unknown) => {
  const dataUrl = String(value ?? '');
  const commaIndex = dataUrl.indexOf(',');
  const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : '';
  const body = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : '';
  if (!header.startsWith('data:') || !header.includes(';base64') || !body) throw Object.assign(new Error('Expected base64 data URL'), { statusCode: 400 });
  const mimeType = header.slice(5).split(';')[0] || 'application/octet-stream';
  return { buffer: Buffer.from(body, 'base64'), mimeType };
};

const installArtifactMiddleware = (middlewares: any) => {
  const artifactsDir = path.resolve(process.env.BEREGA_ARTIFACTS_DIR || path.join(process.cwd(), ARTIFACTS_DIR_NAME));

  middlewares.use(async (req: any, res: any, next: any) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (url.pathname === ARTIFACT_API_PREFIX && method === 'POST') {
      try {
        const payload = await readJsonBody(req);
        const artifactId = sanitizeSegment(payload.artifactId, `artifact-${Date.now()}`);
        const originalName = sanitizeSegment(payload.fileName, 'file');
        const storedName = `${artifactId}-${originalName}`;
        const { buffer, mimeType } = decodeDataUrl(payload.dataUrl);
        await fs.mkdir(artifactsDir, { recursive: true });
        await fs.writeFile(safeArtifactPath(artifactsDir, storedName), buffer);
        sendJson(res, 201, { fileName: storedName, url: artifactUrl(storedName), originalName, mimeType, size: buffer.length });
      } catch (error: any) {
        sendJson(res, error?.statusCode ?? 500, { error: error?.message ?? 'Artifact save failed' });
      }
      return;
    }

    if (!url.pathname.startsWith(`${ARTIFACT_API_PREFIX}/`)) {
      next();
      return;
    }

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    let filePath = '';
    let fileName = '';
    try {
      fileName = decodeURIComponent(url.pathname.slice(ARTIFACT_API_PREFIX.length + 1));
      filePath = safeArtifactPath(artifactsDir, fileName);
    } catch (error: any) {
      sendJson(res, error?.statusCode ?? 400, { error: error?.message ?? 'Bad artifact file name' });
      return;
    }

    if (method === 'GET') {
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error('Not found');
        res.statusCode = 200;
        res.setHeader('Content-Type', contentTypeForFile(fileName));
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', contentDispositionForFile(fileName));
        createReadStream(filePath).pipe(res);
      } catch {
        sendJson(res, 404, { error: 'Not found' });
      }
      return;
    }

    if (method === 'POST') {
      try {
        const trashPath = safeTrashArtifactPath(artifactsDir, fileName);
        try {
          const liveStat = await fs.stat(filePath);
          if (liveStat.isFile()) {
            await fs.rm(trashPath, { force: true });
            res.statusCode = 204;
            res.end();
            return;
          }
        } catch {}
        const trashStat = await fs.stat(trashPath);
        if (!trashStat.isFile()) throw new Error('Not found');
        await fs.mkdir(artifactsDir, { recursive: true });
        await fs.rename(trashPath, filePath);
        res.statusCode = 204;
        res.end();
      } catch {
        sendJson(res, 404, { error: 'Not found' });
      }
      return;
    }

    if (method === 'DELETE') {
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const trashDir = path.join(artifactsDir, ARTIFACT_TRASH_DIR_NAME);
          const trashPath = safeTrashArtifactPath(artifactsDir, fileName);
          await fs.mkdir(trashDir, { recursive: true });
          await fs.rm(trashPath, { force: true });
          await fs.rename(filePath, trashPath);
        }
      } catch {}
      res.statusCode = 204;
      res.end();
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  });
};

const beregaArtifactFilesPlugin = () => ({
  name: 'berega-artifact-files',
  configureServer(server: any) {
    installArtifactMiddleware(server.middlewares);
  },
  configurePreviewServer(server: any) {
    installArtifactMiddleware(server.middlewares);
  },
});

export default defineConfig({
  plugins: [react(), beregaArtifactFilesPlugin()],
});
