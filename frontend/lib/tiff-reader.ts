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
  // Normalize: strip Windows duplicate suffixes like " (1)", " (2)" etc. before matching
  // e.g. "sentinel_B04 (1).tif" → "sentinel_B04.tif"
  const normalized = filename.replace(/\s*\(\d+\)(\.\w+)$/, '$1');
  const u = normalized.toUpperCase();

  if (/B8A/.test(u)) return 'B8A';
  if (/[_\-\.]B02[_\-\.]|_B02\.|B02\.|\bB02\b/.test(u)) return 'B02';
  if (/[_\-\.]B03[_\-\.]|_B03\.|B03\.|\bB03\b/.test(u)) return 'B03';
  if (/[_\-\.]B04[_\-\.]|_B04\.|B04\.|\bB04\b/.test(u)) return 'B04';
  if (/[_\-\.]B08[_\-\.]|_B08\.|B08\.|\bB08\b/.test(u)) return 'B08';
  if (/[_\-\.]B11[_\-\.]|_B11\.|B11\.|\bB11\b/.test(u)) return 'B11';
  if (/[_\-\.]B12[_\-\.]|_B12\.|B12\.|\bB12\b/.test(u)) return 'B12';
  if (/[_\-\.]B01[_\-\.]|_B01\.|B01\.|\bB01\b/.test(u)) return 'B01';
  if (/[_\-\.]B05[_\-\.]|_B05\.|B05\.|\bB05\b/.test(u)) return 'B05';
  if (/[_\-\.]B06[_\-\.]|_B06\.|B06\.|\bB06\b/.test(u)) return 'B06';
  if (/[_\-\.]B07[_\-\.]|_B07\.|B07\.|\bB07\b/.test(u)) return 'B07';
  if (/[_\-\.]B09[_\-\.]|_B09\.|B09\.|\bB09\b/.test(u)) return 'B09';
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
