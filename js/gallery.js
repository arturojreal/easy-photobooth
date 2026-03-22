/** @module gallery - Cloudinary gallery fetch, rendering, and adaptive auto-refresh. */

// ─── Adaptive polling state ──────────────────────────────────────────────────
const BASE_INTERVAL      = 10000; // 10 s (overridden by config.advanced.galleryRefreshInterval)
const MAX_INTERVAL       = 60000; // 60 s ceiling
const BACKOFF_MULTIPLIER = 1.5;

let currentInterval  = BASE_INTERVAL;
let refreshTimer     = null;
let lastPhotoCount   = 0;
let _onRefresh       = null; // callback supplied by app.js

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start adaptive gallery polling.
 * @param {Function} fetchAndRenderFn - async fn that fetches + renders photos; must return current photo count
 * @param {number} [baseMs] - optional override for base interval from config
 */
export function startGalleryRefresh(fetchAndRenderFn, baseMs) {
    stopGalleryRefresh();
    currentInterval = baseMs || BASE_INTERVAL;
    _onRefresh = fetchAndRenderFn;
    scheduleRefresh();
}

/** Stop the polling timer entirely. */
export function stopGalleryRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer    = null;
    _onRefresh      = null;
    currentInterval = BASE_INTERVAL;
    lastPhotoCount  = 0;
}

/**
 * Reset the polling interval back to base and immediately kick off a refresh cycle.
 * Call this right after a successful upload so the gallery catches up fast.
 * @param {number} [baseMs]
 */
export function resetGalleryInterval(baseMs) {
    currentInterval = baseMs || BASE_INTERVAL;
    scheduleRefresh();
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (!_onRefresh) return;

    refreshTimer = setTimeout(async () => {
        try {
            const newCount = await _onRefresh();
            if (typeof newCount === 'number' && newCount > lastPhotoCount) {
                // New photos — snap back to base interval
                currentInterval = BASE_INTERVAL;
                lastPhotoCount  = newCount;
            } else {
                // Nothing new — back off
                currentInterval = Math.min(currentInterval * BACKOFF_MULTIPLIER, MAX_INTERVAL);
            }
        } catch (err) {
            console.error('Gallery refresh error:', err);
        }
        scheduleRefresh();
    }, currentInterval);
}

// ─── Cloud fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch the photo list from Cloudinary via the Netlify function.
 * @returns {Promise<Object[]>} Array of cloud photo objects
 */
export async function fetchPhotosFromCloud() {
    const response = await fetch('/.netlify/functions/list-photos?max_results=100');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.success && data.photos) {
        return data.photos.map(cp => ({
            id:           cp.photoId,
            publicUrl:    cp.url,
            thumbnail:    cp.thumbnail,
            dataUrl:      cp.url,
            timestamp:    new Date(cp.createdAt).getTime(),
            settings:     {},
            uploadSuccess: true,
            cloudPhoto:   true
        }));
    }
    return [];
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Render all photos into the gallery grid element.
 * @param {Object[]} photos - app photo array
 * @param {Set}      selectedPhotos - Set of selected photo IDs
 * @param {Object}   opts - { isPublicGallery, isMobile, mobileAdminEnabled, adminControlsVisible }
 * @param {Function} onToggleSelect   - fn(photoId)
 * @param {Function} onDeleteSingle   - fn(photoId)
 */
export function renderGalleryGrid(photos, selectedPhotos, opts, onToggleSelect, onDeleteSingle) {
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

    if (photos.length === 0) {
        galleryGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
                <h3 style="font-size:24px;margin-bottom:20px;">No Photos Yet</h3>
                <p style="color:var(--text-secondary);font-size:16px;">
                    ${opts.isPublicGallery
                        ? 'Photos will appear here as they are taken at the booth.'
                        : 'Take some photos to get started!'}
                </p>
            </div>`;
        return;
    }

    const hideAdminUI = (opts.isMobile && !opts.mobileAdminEnabled)
                     || (opts.isPublicGallery && !opts.adminControlsVisible);

    photos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-photo-id', photo.id);

        const thumbnail = document.createElement('div');
        thumbnail.className = `gallery-thumbnail ${selectedPhotos.has(photo.id) ? 'selected' : ''}`;

        const checkbox = document.createElement('input');
        checkbox.type      = 'checkbox';
        checkbox.className = 'selection-checkbox';
        checkbox.checked   = selectedPhotos.has(photo.id);
        if (hideAdminUI) checkbox.style.display = 'none';

        const img  = document.createElement('img');
        img.src    = photo.thumbnail || photo.dataUrl;
        img.alt    = `Photo ${index + 1}`;

        thumbnail.appendChild(checkbox);
        thumbnail.appendChild(img);

        const timestamp     = document.createElement('div');
        timestamp.className = 'gallery-timestamp';
        const date          = new Date(photo.timestamp);
        timestamp.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        // URL / status section
        const urlSection       = document.createElement('div');
        urlSection.className   = 'gallery-url-section';
        urlSection.style.cssText = 'margin-top:5px;font-size:11px;display:flex;align-items:center;gap:5px;';
        if (hideAdminUI) urlSection.style.display = 'none';

        if (photo.uploading) {
            urlSection.innerHTML = '<span style="color:var(--warning-color);">⏳ Uploading...</span>';
        } else if (photo.publicUrl) {
            const urlInput    = document.createElement('input');
            urlInput.type     = 'text';
            urlInput.value    = photo.publicUrl;
            urlInput.readOnly = true;
            urlInput.style.cssText = 'flex:1;padding:4px;font-size:10px;background:rgba(255,255,255,0.1);border:1px solid var(--border-color);border-radius:4px;color:var(--text-color);';

            const copyBtn     = document.createElement('button');
            copyBtn.textContent = '📋';
            copyBtn.title     = 'Copy URL';
            copyBtn.style.cssText = 'padding:4px 8px;background:var(--primary-color);border:none;border-radius:4px;cursor:pointer;font-size:14px;';
            copyBtn.onclick   = e => {
                e.stopPropagation();
                navigator.clipboard.writeText(photo.publicUrl).then(() => {
                    copyBtn.textContent = '✅';
                    setTimeout(() => copyBtn.textContent = '📋', 1500);
                });
            };

            urlSection.appendChild(urlInput);
            urlSection.appendChild(copyBtn);
        } else if (photo.uploadError) {
            urlSection.innerHTML = '<span style="color:var(--error-color);">❌ Upload failed</span>';
        }

        // Delete button (admin only)
        const showDelete = (opts.isMobile && opts.mobileAdminEnabled)
                        || (!opts.isMobile && (!opts.isPublicGallery || opts.adminControlsVisible));
        if (showDelete) {
            const deleteBtn       = document.createElement('button');
            deleteBtn.className   = 'gallery-delete-btn';
            deleteBtn.innerHTML   = '🗑️ Delete';
            deleteBtn.style.cssText = 'margin-top:8px;padding:6px 12px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;width:100%;';
            deleteBtn.onclick     = async e => {
                e.stopPropagation();
                if (confirm('Delete this photo? This cannot be undone.')) {
                    await onDeleteSingle(photo.id);
                }
            };
            item.appendChild(deleteBtn);
        }

        checkbox.addEventListener('change', e => {
            e.stopPropagation();
            onToggleSelect(photo.id);
            thumbnail.classList.toggle('selected', selectedPhotos.has(photo.id));
        });

        thumbnail.addEventListener('click', e => {
            if (e.target !== checkbox) {
                window.location.hash = `photo=${photo.id}`;
            }
        });

        item.appendChild(thumbnail);
        item.appendChild(timestamp);
        item.appendChild(urlSection);
        galleryGrid.appendChild(item);
    });
}
