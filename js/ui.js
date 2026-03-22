/** @module ui - Countdown timer, overlays, QR code rendering, toasts, and DOM helpers. */

// ─── Toast ────────────────────────────────────────────────────────────────────

/**
 * Display a dismissible error toast at the top of the page.
 * Auto-dismisses after 5 seconds.
 * @param {string} message
 */
export function showErrorToast(message) {
    // Remove any existing toast first
    const existing = document.getElementById('pb-error-toast');
    if (existing) existing.remove();

    const toast       = document.createElement('div');
    toast.id          = 'pb-error-toast';
    toast.role        = 'alert';
    toast.style.cssText = [
        'position:fixed;top:16px;left:50%;transform:translateX(-50%);',
        'background:#c0392b;color:#fff;padding:14px 24px;border-radius:8px;',
        'font-size:15px;font-weight:600;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,0.4);',
        'display:flex;align-items:center;gap:14px;max-width:90vw;'
    ].join('');

    const msg  = document.createElement('span');
    msg.textContent = message;

    const close       = document.createElement('button');
    close.textContent = '×';
    close.style.cssText = 'background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;';
    close.onclick     = () => toast.remove();

    toast.appendChild(msg);
    toast.appendChild(close);
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 5000);
}

// ─── Countdown ────────────────────────────────────────────────────────────────

/**
 * Run the countdown sequence (3 → 2 → 1 → Smile!) then call `onComplete`.
 * @param {HTMLElement} countdownEl
 * @param {Object}      settings     - flat settings object from PhotoBoothApp
 * @param {Function}    onComplete   - called after the "Smile!" step
 * @param {Function}    setActive    - fn(bool) to toggle countdownActive on the app
 */
export function runCountdown(countdownEl, settings, onComplete, setActive) {
    setActive(true);
    console.log('🎬 COUNTDOWN STARTED');

    if (!countdownEl) {
        console.log('❌ No countdown element found');
        onComplete();
        return;
    }

    const texts     = [settings.textCountdown3, settings.textCountdown2, settings.textCountdown1, settings.textSmile];
    const durations = [
        Math.max(250, settings.countdown3Ms    || 2000),
        Math.max(250, settings.countdown2Ms    || 2000),
        Math.max(250, settings.countdown1Ms    || 2000),
        Math.max(300, settings.countdownSmileHoldMs || 1200)
    ];

    countdownEl.style.display = 'block';
    let idx = 0;

    const showNext = () => {
        if (idx >= texts.length) return;
        const text      = texts[idx];
        const duration  = durations[idx];
        const animDur   = Math.max(200, duration - 150);

        countdownEl.textContent  = text;
        countdownEl.style.fontSize  = `${settings.countdownSizeVW}vw`;
        countdownEl.style.fontWeight = text === settings.textSmile ? '700' : '900';
        countdownEl.style.opacity    = 0;
        countdownEl.style.scale      = 1;

        anime({
            targets:  countdownEl,
            opacity:  [0, 1],
            duration: 200,
            easing:   'linear',
            complete: () => {
                setTimeout(() => {
                    anime({
                        targets:  countdownEl,
                        opacity:  [1, 0],
                        duration: 200,
                        easing:   'linear',
                        complete: () => {
                            idx++;
                            if (idx < texts.length) {
                                showNext();
                            } else {
                                onComplete();
                                countdownEl.style.display = 'none';
                                setActive(false);
                                console.log('🏁 COUNTDOWN COMPLETE');
                            }
                        }
                    });
                }, duration - 400);
            }
        });
    };

    showNext();
}

// ─── Flash ────────────────────────────────────────────────────────────────────

/** Trigger the white-flash overlay animation. */
export function triggerFlash() {
    const flashOverlay = document.getElementById('flashOverlay');
    if (!flashOverlay) return;
    flashOverlay.classList.add('flash-active');
    setTimeout(() => flashOverlay.classList.remove('flash-active'), 200);
}

// ─── QR Codes ────────────────────────────────────────────────────────────────

/**
 * Render a QR code for the current photo result view (post-capture screen).
 * Shows a gallery link QR so attendees can scan and see all photos.
 */
export async function generateGalleryQRCode() {
    const container = document.getElementById('galleryQRCode');
    if (!container) return;
    container.innerHTML = '';

    try {
        const galleryUrl = `${window.location.origin}${window.location.pathname}#gallery-public`;
        const canvas     = document.createElement('canvas');
        canvas.width = canvas.height = 300;
        container.appendChild(canvas);
        await QRCode.toCanvas(canvas, galleryUrl, {
            width:  300, margin: 2,
            color:  { dark: '#000000', light: '#FFFFFF' }
        });
        console.log('✅ Gallery QR generated:', galleryUrl);
    } catch (err) {
        console.error('Gallery QR generation failed:', err);
        container.innerHTML = '<p style="color:var(--error-color);text-align:center;padding:20px;">QR Code generation failed</p>';
    }
}

/**
 * Render the per-photo QR code in the capture result overlay.
 * @param {string}   photoId
 * @param {Object[]} photos         - app photos array
 * @param {string}   qrOverrideUrl  - optional URL override from settings
 * @param {boolean}  cloudEnabled
 */
export async function generateQRCode(photoId, photos, qrOverrideUrl, cloudEnabled) {
    const container = document.getElementById('qrCode');
    if (!container) return;
    container.innerHTML = '';

    try {
        const photo = photos.find(p => p.id === photoId);
        if (!photo) {
            container.innerHTML = '<p style="color:var(--error-color);text-align:center;padding:20px;">Photo not found</p>';
            return;
        }

        let shareUrl;
        if (qrOverrideUrl?.trim()) {
            shareUrl = qrOverrideUrl.trim();
        } else if (photo.publicUrl) {
            shareUrl = photo.publicUrl;
        } else if (photo.uploading) {
            container.innerHTML = '<p style="color:var(--warning-color);text-align:center;padding:20px;">⏳ Uploading to cloud...</p>';
            return;
        } else if (photo.cloudDisabled || !cloudEnabled) {
            container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;font-size:14px;">📱 Local Mode<br><small>Enable cloud storage in debug panel for public URLs</small></p>';
            return;
        } else {
            shareUrl = `${window.location.origin}${window.location.pathname}#photo=${photoId}`;
        }

        const canvas     = document.createElement('canvas');
        canvas.id        = 'qrCanvas';
        canvas.width = canvas.height = 200;
        container.appendChild(canvas);
        await QRCode.toCanvas(canvas, shareUrl, {
            width: 200, margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        const urlDisplay       = document.createElement('div');
        urlDisplay.style.cssText = 'margin-top:10px;font-size:10px;word-break:break-all;color:var(--text-secondary);text-align:center;';
        urlDisplay.textContent = shareUrl;
        container.appendChild(urlDisplay);
    } catch (err) {
        console.error('QR generation failed:', err);
        container.innerHTML = '<p style="color:var(--error-color);text-align:center;padding:20px;">QR Code generation failed</p>';
    }
}

/**
 * Render QR code on the single-photo share page.
 * @param {Object} photo
 */
export async function generateSinglePhotoQRCode(photo) {
    const container = document.getElementById('singlePhotoQRCode');
    if (!container) return;
    container.innerHTML = '';

    try {
        let shareUrl;
        if (photo.publicUrl) {
            shareUrl = photo.publicUrl;
        } else if (photo.uploading) {
            container.innerHTML = '<p style="color:var(--warning-color);padding:20px;font-size:16px;">⏳ Uploading...</p>';
            return;
        } else {
            shareUrl = `${window.location.origin}${window.location.pathname}#photo=${photo.id}`;
        }

        const canvas     = document.createElement('canvas');
        canvas.width = canvas.height = 400;
        container.appendChild(canvas);
        await QRCode.toCanvas(canvas, shareUrl, {
            width: 400, margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        const urlDisplay       = document.createElement('div');
        urlDisplay.style.cssText = 'margin-top:20px;font-size:14px;word-break:break-all;color:var(--text-secondary);line-height:1.6;';
        urlDisplay.textContent = shareUrl;
        container.appendChild(urlDisplay);
    } catch (err) {
        console.error('Single photo QR generation failed:', err);
        container.innerHTML = '<p style="color:var(--error-color);padding:10px;">QR failed</p>';
    }
}

// ─── UI state helpers ─────────────────────────────────────────────────────────

/**
 * Update element visibility, text, and colors from current settings.
 * @param {Object} settings - flat settings object
 */
export function updateUIElements(settings) {
    const instructions = document.querySelector('.instructions-container');
    if (instructions) {
        instructions.style.display         = settings.showInstructions ? 'block' : 'none';
        instructions.textContent           = settings.textInstructions;
        instructions.style.color           = settings.colorInstructions;
        instructions.style.backgroundColor = settings.bgColorInstructions;
    }

    const branding = document.querySelector('.branding h2');
    if (branding) {
        branding.parentElement.style.display         = settings.showBranding ? 'block' : 'none';
        branding.textContent                         = settings.textBranding;
        branding.style.color                         = settings.colorBranding;
        branding.parentElement.style.backgroundColor = settings.bgColorBranding;
    }

    const keyHint = document.querySelector('.key-hint');
    if (keyHint) {
        keyHint.style.display         = settings.showKeyHints ? 'block' : 'none';
        keyHint.textContent           = settings.textKeyHints;
        keyHint.style.color           = settings.colorKeyHints;
        keyHint.style.backgroundColor = settings.bgColorKeyHints;
    }

    const stompboxIndicator = document.getElementById('stompboxIndicator');
    if (stompboxIndicator) {
        stompboxIndicator.style.display         = settings.showStompboxIndicator ? 'block' : 'none';
        stompboxIndicator.style.color           = settings.colorStompbox;
        stompboxIndicator.style.backgroundColor = settings.bgColorStompbox;
    }

    const countdownDisplay = document.getElementById('countdownDisplay');
    if (countdownDisplay) {
        countdownDisplay.style.color           = settings.colorCountdown;
        countdownDisplay.style.backgroundColor = settings.bgColorCountdown;
    }
}

/**
 * Apply CSS custom properties for all layout positions from settings.
 * @param {Object} settings
 */
export function updateElementPositions(settings) {
    const root = document.documentElement;
    root.style.setProperty('--camera-left',        `${settings.cameraLeft}vw`);
    root.style.setProperty('--camera-top',         `${settings.cameraTop}vh`);
    root.style.setProperty('--camera-width-vw',    `${settings.cameraWidth}vw`);
    root.style.setProperty('--countdown-bottom',   `${settings.countdownBottomVH}vh`);
    root.style.setProperty('--countdown-left',     `${settings.countdownLeftVW}vw`);
    root.style.setProperty('--countdown-size',     `${settings.countdownSizeVW}vw`);
    root.style.setProperty('--stompbox-top',       `${settings.stompboxTopVH}vh`);
    root.style.setProperty('--stompbox-left',      `${settings.stompboxLeftVW}vw`);
    root.style.setProperty('--instructions-bottom',`${settings.instructionsBottomPX}px`);
    root.style.setProperty('--instructions-width', `${settings.instructionsWidthPercent}%`);

    const stompbox = document.getElementById('stompboxIndicator');
    if (stompbox) stompbox.style.fontSize = `${settings.stompboxFontPX}px`;

    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        if (settings.backgroundImageData) {
            mainContainer.style.background = `url(${settings.backgroundImageData}) center/cover no-repeat fixed`;
        } else if (settings.backgroundImageUrl) {
            mainContainer.style.background = `url(${settings.backgroundImageUrl}) center/cover no-repeat fixed`;
        } else {
            mainContainer.style.background = 'var(--background-color)';
        }
    }
}

/**
 * Apply CSS custom properties for single-photo page sizing.
 * @param {Object} settings
 */
export function updateSinglePhotoPageSizing(settings) {
    const root = document.documentElement;
    root.style.setProperty('--single-photo-image-height', `${settings.singlePhotoImageHeight}vh`);
    root.style.setProperty('--share-buttons-padding',     `${settings.shareButtonsPadding}px`);
    root.style.setProperty('--share-button-size',         `${settings.shareButtonSize}px`);
    root.style.setProperty('--qr-code-size',              `${settings.qrCodeSize}px`);
    root.style.setProperty('--single-photo-gap',          `${settings.singlePhotoGap}px`);
}

/**
 * Update a status indicator badge in the debug panel.
 * @param {string} elementId
 * @param {string} text
 * @param {'success'|'error'|'warning'} status
 */
export function updateSystemStatus(elementId, text, status) {
    const el = document.getElementById(elementId);
    if (el) {
        el.className = `status-indicator status-${status}`;
        el.innerHTML = `<span>●</span> ${text}`;
    }
}
