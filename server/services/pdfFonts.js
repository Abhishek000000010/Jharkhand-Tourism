import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Unicode text for generated PDFs.
 *
 * jsPDF's built-in fonts are the 14 PDF base fonts, which are WinAnsi-encoded
 * and have no rupee sign — printing "₹" with Helvetica yields a blank box, which
 * is why every amount used to read "Rs 100.00". Embedding a font that actually
 * carries U+20B9 is the only way to set the real symbol.
 *
 * Roboto is used because it is Apache-2.0 (safe to redistribute inside a PDF the
 * department hands to travellers), covers U+20B9, and its TTFs are ~155KB each —
 * small enough to embed two weights without bloating an emailed voucher. The
 * system fonts on the build machine are deliberately NOT used: Arial and Calibri
 * are licensed and must not be shipped inside generated documents.
 */

export const FONT = 'Roboto';

/** The reference stays monospaced, and Courier is a built-in — no bytes added. */
export const MONO = 'courier';

// Read and base64 once per process. jsPDF's virtual file system is per-document,
// so the strings are re-registered on each PDF, but the disk read and the
// encoding — the expensive parts — happen a single time.
const load = (file) => {
  const dir = path.dirname(require.resolve('@expo-google-fonts/roboto/package.json'));
  return fs.readFileSync(path.join(dir, file)).toString('base64');
};

let cache = null;

const faces = () => {
  if (!cache) {
    cache = [
      { file: 'Roboto-Regular.ttf', style: 'normal', data: load('400Regular/Roboto_400Regular.ttf') },
      { file: 'Roboto-Bold.ttf', style: 'bold', data: load('700Bold/Roboto_700Bold.ttf') },
    ];
  }
  return cache;
};

/**
 * Register the embedded family on a jsPDF document and select it.
 * Call once, immediately after creating the document.
 */
export const useUnicodeFont = (doc) => {
  for (const face of faces()) {
    doc.addFileToVFS(face.file, face.data);
    doc.addFont(face.file, FONT, face.style);
  }
  doc.setFont(FONT, 'normal');
  return doc;
};
