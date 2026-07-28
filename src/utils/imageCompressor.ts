import heic2any from 'heic2any';

/**
 * Converts HEIC/HEIF files (common on iPhones) to standard JPEG Blob
 */
async function ensureStandardImageBlob(file: File | Blob): Promise<Blob | File> {
  const fileName = ((file as File).name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();
  const isHeic =
    fileType.includes('heic') ||
    fileType.includes('heif') ||
    fileName.endsWith('.heic') ||
    fileName.endsWith('.heif');

  if (isHeic) {
    try {
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      });
      return Array.isArray(converted) ? converted[0] : converted;
    } catch (err) {
      console.warn('heic2any conversion failed during initial check:', err);
    }
  }
  return file;
}

/**
 * Helper to compress user uploaded profile images in browser
 * Resizes to max dimension (e.g. 350px) and compresses to ~30-50KB WebP/JPEG data URL.
 * Designed to handle high-resolution mobile camera photos (iOS & Android) smoothly.
 */
export async function compressProfileImage(
  input: File | Blob,
  maxDimension = 350,
  quality = 0.8
): Promise<string> {
  let file = await ensureStandardImageBlob(input);

  // Method 1: Try createImageBitmap if available (native GPU async decoding on modern mobile browsers)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      let { width, height } = bitmap;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData && webpData.startsWith('data:image/webp') && webpData.length > 100) {
            return webpData;
          }
        } catch {
          // Fallback to jpeg
        }

        const jpegData = canvas.toDataURL('image/jpeg', quality);
        if (jpegData && jpegData.length > 100) {
          return jpegData;
        }
      }
    } catch (e) {
      console.warn('createImageBitmap failed, trying fallback methods:', e);
    }
  }

  // Method 2: Try URL.createObjectURL + HTMLImageElement
  try {
    return await compressWithImageElement(file, maxDimension, quality);
  } catch (err) {
    console.warn('HTMLImageElement compression failed, trying heic2any fallback:', err);
    // As a last-resort fallback for misidentified HEIC or unusual mobile camera formats
    try {
      const fallbackConverted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      });
      const validBlob = Array.isArray(fallbackConverted) ? fallbackConverted[0] : fallbackConverted;
      return await compressWithImageElement(validBlob, maxDimension, quality);
    } catch (finalErr) {
      console.error('All image compression methods failed:', finalErr);
      throw new Error('Não foi possível processar a imagem. Tente outra foto.');
    }
  }
}

function compressWithImageElement(
  blob: Blob | File,
  maxDimension: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(blob);
    } catch (e) {
      return readWithFileReader(blob, maxDimension, quality).then(resolve).catch(reject);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanup = () => {
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch {}
      }
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      readWithFileReader(blob, maxDimension, quality).then(resolve).catch(reject);
    };

    img.src = objectUrl;
  });
}

function readWithFileReader(
  blob: Blob | File,
  maxDimension: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData && webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {}

        const jpegData = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegData);
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(blob);
  });
}

