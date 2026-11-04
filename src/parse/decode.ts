export interface Decoded {
  text: string;
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1256';
}

/**
 * Decodes CSV bytes. BOMs are honoured; otherwise strict UTF-8 is tried first
 * and Windows-1256 (common for Arabic Excel CSV exports) is the fallback.
 */
export function decodeText(bytes: Uint8Array): Decoded {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1256').decode(bytes), encoding: 'windows-1256' };
  }
}
