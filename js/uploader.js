/** @module uploader - Cloudinary upload via Netlify function, with local-storage fallback. */

import { resetGalleryInterval } from './gallery.js';
import { showErrorToast }       from './ui.js';

/**
 * Upload a photo to Cloudinary via the Netlify serverless function.
 * On failure, falls back to localStorage if `fallbackToLocal` is enabled.
 *
 * @param {Object}   photoData       - { id, dataUrl, timestamp, settings }
 * @param {boolean}  fallbackToLocal - save to localStorage on failure
 * @param {number}   [baseRefreshMs] - base gallery poll interval to reset after upload
 * @returns {Promise<Object>}        - upload result from Cloudinary
 */
export async function uploadPhotoToCloud(photoData, fallbackToLocal = true, baseRefreshMs) {
    const UPLOAD_TIMEOUT = 30000;

    console.log('📤 Uploading photo to cloud:', photoData.id);
    console.time(`Upload ${photoData.id}`);

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

    try {
        const response = await fetch('/.netlify/functions/upload-photo', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                image:    photoData.dataUrl,
                photoId:  photoData.id,
                metadata: {
                    timestamp: photoData.timestamp,
                    settings:  photoData.settings
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Surface env-var hint from the function if present
            const msg = errorData.error || errorData.message || `Upload failed: ${response.statusText}`;
            if (errorData.hint) console.warn('💡', errorData.hint);
            throw new Error(msg);
        }

        const result = await response.json();
        console.timeEnd(`Upload ${photoData.id}`);
        console.log('✅ Photo uploaded successfully:', result.url);

        // Update the photo object in place
        photoData.publicUrl    = result.url;
        photoData.thumbnail    = result.thumbnail;
        photoData.uploading    = false;
        photoData.uploadSuccess = true;
        delete photoData.uploadError;
        delete photoData.dataUrl; // Free memory — photo now served from Cloudinary

        // Reset gallery to fast polling right after a successful upload
        resetGalleryInterval(baseRefreshMs);

        return result;

    } catch (err) {
        clearTimeout(timeoutId);
        console.timeEnd(`Upload ${photoData.id}`);
        console.error('❌ Upload error:', err);

        photoData.uploading  = false;
        photoData.uploadError = err.name === 'AbortError' ? 'Upload timeout' : err.message;

        if (fallbackToLocal) {
            // Preserve the dataUrl in localStorage under a timestamped key
            try {
                const key = `photobooth-failed-${photoData.id}-${Date.now()}`;
                localStorage.setItem(key, photoData.dataUrl || '');
                showErrorToast('Upload failed — photo saved locally.');
            } catch (_) {
                showErrorToast('Upload failed — unable to save locally (storage full).');
            }
        } else {
            showErrorToast('Upload failed — please retake the photo.');
        }

        throw err;
    }
}
