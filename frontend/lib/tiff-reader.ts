/**
 * tiff-reader.ts
 *
 * Client-side GeoTIFF band sampling using geotiff.js.
 * Reads a center 500×500 window from each uploaded Sentinel-2 band file
 * and returns the mean reflectance — without uploading raw TIFFs to the server.
 *
 * This completely eliminates the large-file upload that was crashing Render Free Tier.
 */

import { fromArrayBuffer } from 'geotiff';

/**
 * Detects the Sentinel-2 band code from a filename.
 * Returns e.g. "B02", "B08", "B11", or null if unrecognized.
 */
export function detectBandFromFilename(filename: string): string | null {
  const u = filename.toUpperCase();
  if (/B8A/.test(u)) return 'B8A';
  if (/[_\-\.]B02[_\-\.]|B02\./.test(u) || /\bB02\b/.test(u)) return 'B02';
  if (/[_\-\.]B03[_\-\.]|B03\./.test(u) || /\bB03\b/.test(u)) return 'B03';
  if (/[_\-\.]B04[_\-\.]|B04\./.test(u) || /\bB04\b/.test(u)) return 'B04';
  if (/[_\-\.]B08[_\-\.]|B08\./.test(u) || /\bB08\b/.test(u)) return 'B08';
  if (/[_\-\.]B11[_\-\.]|B11\./.test(u) || /\bB11\b/.test(u)) return 'B11';
  if (/[_\-\.]B12[_\-\.]|B12\./.test(u) || /\bB12\b/.test(u)) return 'B12';
  if (/[_\-\.]B01[_\-\.]|B01\./.test(u) || /\bB01\b/.test(u)) return 'B01';
  if (/[_\-\.]B05[_\-\.]|B05\./.test(u) || /\bB05\b/.test(u)) return 'B05';
  if (/[_\-\.]B06[_\-\.]|B06\./.test(u) || /\bB06\b/.test(u)) return 'B06';
  if (/[_\-\.]B07[_\-\.]|B07\./.test(u) || /\bB07\b/.test(u)) return 'B07';
  if (/[_\-\.]B09[_\-\.]|B09\./.test(u) || /\bB09\b/.test(u)) return 'B09';
  if (/NIR/.test(u)) return 'B08';
  if (/SWIR1|SWIR-1/.test(u)) return 'B11';
  if (/SWIR2|SWIR-2/.test(u)) return 'B12';
  return null;
}

/**
 * Reads a GeoTIFF file and returns the mean of a center sample window.
 *
 * The browser keeps the TIFF as an ArrayBuffer (compressed, same as disk).
 * geotiff.js decodes only the requested window tiles — never the full image.
 *
 * @param file      The File object from the input/drop
 * @param sampleSize Width & height of the center square to sample (default 500px)
 * @returns Mean reflectance value of the sampled window (ignoring zeros/nodata)
 */
export async function sampleBandMean(file: File, sampleSize = 500): Promise<number> {
  const buffer = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();

  // Center window — capped at actual image size
  const winW = Math.min(width, sampleSize);
  const winH = Math.min(height, sampleSize);
  const xOff = Math.floor((width - winW) / 2);
  const yOff = Math.floor((height - winH) / 2);

  // Read only the center window (geotiff.js uses tile-based access)
  const rasters = await image.readRasters({
    window: [xOff, yOff, xOff + winW, yOff + winH],
    samples: [0]  // band 1
  });

  const band = rasters[0] as Float32Array | Int16Array | Uint16Array | Float64Array;

  // Compute mean ignoring zero/nodata pixels
  let sum = 0;
  let count = 0;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (v !== 0 && isFinite(v) && !isNaN(v)) {
      sum += v;
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Computes band means for all provided files concurrently.
 *
 * @param files     Array of File objects (Sentinel-2 band GeoTIFFs)
 * @param onProgress  Optional callback called after each file is processed
 * @returns Record mapping band code ("B02", "B08", ...) to mean reflectance
 */
export async function computeBandMeans(
  files: File[],
  onProgress?: (done: number, total: number, bandId: string) => void
): Promise<Record<string, number>> {
  const bandMeans: Record<string, number> = {};

  // Process sequentially to keep memory usage low (one TIFF in memory at a time)
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const bandId = detectBandFromFilename(file.name);
    if (!bandId) {
      console.warn(`[TiffReader] Could not detect band for "${file.name}" — skipping`);
      onProgress?.(i + 1, files.length, 'UNKNOWN');
      continue;
    }

    try {
      console.log(`[TiffReader] Sampling ${bandId} from "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      const mean = await sampleBandMean(file);
      bandMeans[bandId] = mean;
      console.log(`[TiffReader] ${bandId} mean = ${mean.toFixed(2)}`);
    } catch (err) {
      console.warn(`[TiffReader] Failed to read ${bandId} (${file.name}):`, err);
    }
    onProgress?.(i + 1, files.length, bandId);
  }

  return bandMeans;
}
