import { Socket } from 'node:net';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ScanResult =
  | { scanned: true; infected: boolean; signature?: string }
  | { scanned: false };

/**
 * Sprint Enterprise 0, axe E6 (gestion documentaire entreprise, docs/14-ROADMAP-SAAS-PREMIUM.md) -
 * scans an uploaded document's real bytes against a ClamAV daemon (`clamd`) before
 * DocumentsService persists it, closing the "antivirus" gap this repo's own presentation doc
 * (docs/23-PRESENTATION-DIRECTION-GENERALE.md, §8) already names: uploads were validated by
 * magic-byte signature and size only (document-policy.js), never by content.
 *
 * Talks clamd's own INSTREAM wire protocol directly over TCP rather than pulling in a client
 * library - the protocol is short and stable (documented in clamd's own man page), and this repo
 * already prefers a direct, auditable implementation over a wrapper dependency for something this
 * size (see documents.service.ts's own use of `node:crypto` for checksums rather than a checksum
 * package). INSTREAM: send `zINSTREAM\0`, then the file as `<4-byte big-endian chunk length><chunk
 * bytes>` pairs, terminated by a zero-length chunk, then read clamd's one-line reply
 * ("stream: OK", "stream: <signature> FOUND", or "stream: <reason> ERROR").
 *
 * Optional and off by default, matching this codebase's existing pattern for infrastructure that
 * needs an external service the local demo stack doesn't require (OidcService#isEnabled,
 * tracing.ts's OTEL_EXPORTER_OTLP_ENDPOINT gate): `isEnabled()` is false, `scan()` a pure
 * pass-through (`{ scanned: false }`), whenever CLAMAV_HOST is unset - the local Docker demo and
 * CI's own document integration tests never require a running ClamAV daemon. Once CLAMAV_HOST IS
 * set, a scan failure (daemon unreachable, protocol error) is NOT silently swallowed - it throws,
 * and DocumentsService turns that into a 503 rather than accepting an unscanned upload: a security
 * control that is configured but silently bypassed on error is worse than temporarily refusing
 * uploads until the daemon is fixed.
 */
@Injectable()
export class ClamAvService {
  private readonly logger = new Logger(ClamAvService.name);
  private readonly host?: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.host = config.get<string>('CLAMAV_HOST') || undefined;
    this.port = Number(config.get<string>('CLAMAV_PORT') ?? '3310');
    this.timeoutMs = Number(config.get<string>('CLAMAV_TIMEOUT_MS') ?? '15000');
  }

  isEnabled(): boolean {
    return Boolean(this.host);
  }

  async scan(buffer: Buffer): Promise<ScanResult> {
    const host = this.host;
    if (!host) return { scanned: false };
    const reply = await this.instream(host, buffer);
    if (reply.includes('ERROR')) {
      this.logger.error(`ClamAV scan error: ${reply}`);
      throw new Error(`ClamAV scan error: ${reply}`);
    }
    const infected = reply.includes('FOUND');
    if (!infected) return { scanned: true, infected: false };
    const signature = reply.replace(/^stream:\s*/, '').replace(/\s*FOUND\s*$/, '').trim();
    return { scanned: true, infected: true, signature };
  }

  private instream(host: string, buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let response = '';
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        fn();
      };

      const timer = setTimeout(() => {
        finish(() => reject(new Error(`ClamAV scan timed out after ${this.timeoutMs}ms`)));
      }, this.timeoutMs);

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        const chunkSize = 2 * 1024 * 1024;
        for (let offset = 0; offset < buffer.length; offset += chunkSize) {
          const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length, 0);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4)); // zero-length chunk terminates the stream
      });
      socket.on('data', (data) => { response += data.toString('utf8'); });
      socket.on('end', () => finish(() => resolve(response.trim())));
      socket.on('error', (error) => finish(() => reject(error)));
      socket.connect(this.port, host);
    });
  }
}
