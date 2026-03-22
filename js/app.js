/**
 * @module app - Orchestration entry point. Imports all feature modules and wires
 * event listeners. All application state lives on the PhotoBoothApp instance,
 * which is exposed as window.photoBoothApp for inline HTML onclick handlers.
 */

import { initCamera, switchCamera, applyCameraFilters, captureFrame } from './camera.js';
import {
    startGalleryRefresh, stopGalleryRefresh, resetGalleryInterval,
    fetchPhotosFromCloud, renderGalleryGrid
} from './gallery.js';
import { uploadPhotoToCloud }     from './uploader.js';
import {
    runCountdown, triggerFlash,
    generateGalleryQRCode, generateQRCode, generateSinglePhotoQRCode,
    updateUIElements, updateElementPositions, updateSinglePhotoPageSizing, updateSystemStatus,
    showErrorToast
} from './ui.js';

class PhotoBoothApp {
    constructor() {
        // ── Default settings ─────────────────────────────────────────────────
        // These are the runtime defaults. config.js (loaded as a plain <script>)
        // may expose PHOTOBOOTH_CONFIG — if so, we merge it in initializeApp().
        this.settings = {
            stompDelay:              1000,
            countdownDuration:       3,
            displayDuration:         12000,
            progressDuration:        15000,
            captureLockoutSeconds:   10,
            photoQuality:            0.92,
            resolution:              '1920x1080',
            brightness:              0,
            contrast:                100,
            saturation:              100,
            hue:                     0,
            cameraLeft:              50,
            cameraTop:               50,
            cameraWidth:             87,
            showInstructions:        true,
            showBranding:            true,
            showKeyHints:            true,
            showStompboxIndicator:   true,
            countdownBottomVH:       12,
            countdownLeftVW:         50,
            countdownSizeVW:         8,
            countdownStepMs:         2000,
            countdownSmileHoldMs:    1000,
            stompboxTopVH:           75,
            stompboxLeftVW:          40,
            stompboxFontPX:          25,
            instructionsBottomPX:    17,
            instructionsWidthPercent:40,
            qrOverrideUrl:           '',
            backgroundImageUrl:      '',
            backgroundImageData:     '',
            galleryBackgroundImageUrl: '',
            galleryBackgroundColor:  '#ffffff',
            countdown3Ms:            1000,
            countdown2Ms:            1000,
            countdown1Ms:            1000,
            textCountdown3:          '3',
            textCountdown2:          '2',
            textCountdown1:          '1',
            textSmile:               'Smile!',
            textStompboxActivated:   '📸 Stompbox Activated - Get Ready!',
            textBranding:            'Event Photobooth',
            textInstructions:        'Step lightly on the stompbox to snap a photo, then wait for the QR code!',
            textKeyHints:            "Press 'G' for Gallery • 'D' for Debug • Spacebar to simulate stompbox",
            colorCountdown:          '#ffffff',
            colorBranding:           '#212121',
            colorInstructions:       '#212121',
            colorKeyHints:           '#212121',
            colorStompbox:           '#212121',
            bgColorCountdown:        '#1976d2',
            bgColorBranding:         '#f5f5f6',
            bgColorInstructions:     '#f5f5f6',
            bgColorKeyHints:         '#f5f5f6',
            bgColorStompbox:         '#f5f5f6',
            singlePhotoImageHeight:  80,
            shareButtonsPadding:     40,
            shareButtonSize:         16,
            qrCodeSize:              400,
            singlePhotoGap:          60,
            cloudStorageEnabled:     true,
            fallbackToLocal:         true,   // save photo locally if upload fails
        };

        // ── App state ────────────────────────────────────────────────────────
        this.photos              = [];
        this.selectedPhotos      = new Set();
        this.isCapturing         = false;
        this.countdownActive     = false;
        this.isPublicGallery     = false;
        this.adminControlsVisible= false;
        this.isMobile            = false;
        this.cameraDisabled      = false;
        this.mobileAdminEnabled  = false;
        this.tapCount            = 0;
        this.tapTimer            = null;
        this.lastCaptureTime     = 0;
        this.photoCounter        = 0;
        this.isFetchingPhotos    = false;
        this.currentPhotoId      = null;
        this.progressAnimation   = null;

        this.initializeApp();
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    async initializeApp() {
        // Merge config.js values if present (config.js exposes PHOTOBOOTH_CONFIG globally)
        if (typeof PHOTOBOOTH_CONFIG !== 'undefined') {
            this._mergeConfig(PHOTOBOOTH_CONFIG);
        }

        await this.loadPhotosFromStorage();

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                     || window.innerWidth < 768;

        const hash = window.location.hash;
        if (this.isMobile || hash === '#gallery-public' || hash.startsWith('#photo=')) {
            this.cameraDisabled = true;
            if (this.isMobile && (!hash || hash === '#')) {
                window.location.hash = '#gallery-public';
            }
        } else {
            await initCamera(this.settings, (id, text, status) => updateSystemStatus(id, text, status));
        }

        this.setupEventListeners();
        this.setupDebugPanel();
        applyCameraFilters(this.settings);
        updateUIElements(this.settings);
        updateElementPositions(this.settings);
        updateSinglePhotoPageSizing(this.settings);
        this.setupHashRouting();
        this.handleUrlHash();
        this.checkCloudStorageStatus();

        if (this.isMobile) {
            this.setupMobileAdminAccess();
        }
    }

    /**
     * Merge a PHOTOBOOTH_CONFIG object (from config.js) into this.settings.
     * Maps the nested config structure to the flat settings keys.
     */
    _mergeConfig(cfg) {
        const s = this.settings;
        const b = cfg.branding  || {};
        const t = cfg.timing    || {};
        const c = cfg.camera    || {};
        const p = cfg.positioning || {};
        const tx = cfg.text     || {};
        const cl = cfg.colors   || {};
        const bg = cfg.backgroundColors || {};
        const v  = cfg.visibility || {};
        const sp = cfg.singlePhotoPage || {};
        const cs = cfg.cloudStorage || {};
        const adv = cfg.advanced || {};

        if (b.eventName)              s.textBranding                = b.eventName;
        if (b.galleryBackgroundColor) s.galleryBackgroundColor      = b.galleryBackgroundColor;
        if (b.backgroundImage)        s.backgroundImageUrl          = b.backgroundImage;
        if (b.galleryBackgroundImage) s.galleryBackgroundImageUrl   = b.galleryBackgroundImage;
        if (t.stompboxDelay    != null) s.stompDelay                = t.stompboxDelay;
        if (t.countdown3Duration != null) s.countdown3Ms            = t.countdown3Duration;
        if (t.countdown2Duration != null) s.countdown2Ms            = t.countdown2Duration;
        if (t.countdown1Duration != null) s.countdown1Ms            = t.countdown1Duration;
        if (t.smileHoldDuration != null) s.countdownSmileHoldMs     = t.smileHoldDuration;
        if (t.photoDisplayDuration != null) s.displayDuration       = t.photoDisplayDuration;
        if (t.progressBarDuration != null) s.progressDuration       = t.progressBarDuration;
        if (t.captureLockoutSeconds != null) s.captureLockoutSeconds= t.captureLockoutSeconds;
        if (c.photoQuality != null)   s.photoQuality                = c.photoQuality;
        if (c.brightness != null)     s.brightness                  = c.brightness;
        if (c.contrast != null)       s.contrast                    = c.contrast;
        if (c.saturation != null)     s.saturation                  = c.saturation;
        if (c.hue != null)            s.hue                         = c.hue;
        if (p.cameraLeft != null)     s.cameraLeft                  = p.cameraLeft;
        if (p.cameraTop != null)      s.cameraTop                   = p.cameraTop;
        if (p.cameraWidth != null)    s.cameraWidth                 = p.cameraWidth;
        if (p.countdownBottom != null) s.countdownBottomVH          = p.countdownBottom;
        if (p.countdownLeft != null)  s.countdownLeftVW             = p.countdownLeft;
        if (p.countdownSize != null)  s.countdownSizeVW             = p.countdownSize;
        if (p.stompboxTop != null)    s.stompboxTopVH               = p.stompboxTop;
        if (p.stompboxLeft != null)   s.stompboxLeftVW              = p.stompboxLeft;
        if (p.stompboxFontSize != null) s.stompboxFontPX            = p.stompboxFontSize;
        if (p.instructionsBottom != null) s.instructionsBottomPX    = p.instructionsBottom;
        if (p.instructionsWidth != null) s.instructionsWidthPercent = p.instructionsWidth;
        if (tx.countdown3)            s.textCountdown3              = tx.countdown3;
        if (tx.countdown2)            s.textCountdown2              = tx.countdown2;
        if (tx.countdown1)            s.textCountdown1              = tx.countdown1;
        if (tx.smile)                 s.textSmile                   = tx.smile;
        if (tx.stompboxActivated)     s.textStompboxActivated       = tx.stompboxActivated;
        if (tx.instructions)          s.textInstructions            = tx.instructions;
        if (tx.keyHints)              s.textKeyHints                = tx.keyHints;
        if (cl.countdown)             s.colorCountdown              = cl.countdown;
        if (cl.branding)              s.colorBranding               = cl.branding;
        if (cl.instructions)          s.colorInstructions           = cl.instructions;
        if (cl.keyHints)              s.colorKeyHints               = cl.keyHints;
        if (cl.stompbox)              s.colorStompbox               = cl.stompbox;
        if (bg.countdown)             s.bgColorCountdown            = bg.countdown;
        if (bg.branding)              s.bgColorBranding             = bg.branding;
        if (bg.instructions)          s.bgColorInstructions         = bg.instructions;
        if (bg.keyHints)              s.bgColorKeyHints             = bg.keyHints;
        if (bg.stompbox)              s.bgColorStompbox             = bg.stompbox;
        if (v.showInstructions != null)   s.showInstructions        = v.showInstructions;
        if (v.showBranding != null)       s.showBranding            = v.showBranding;
        if (v.showKeyHints != null)       s.showKeyHints            = v.showKeyHints;
        if (v.showStompboxIndicator != null) s.showStompboxIndicator = v.showStompboxIndicator;
        if (sp.imageHeight != null)       s.singlePhotoImageHeight  = sp.imageHeight;
        if (sp.shareButtonsPadding != null) s.shareButtonsPadding   = sp.shareButtonsPadding;
        if (sp.shareButtonSize != null)   s.shareButtonSize         = sp.shareButtonSize;
        if (sp.qrCodeSize != null)        s.qrCodeSize              = sp.qrCodeSize;
        if (sp.sectionGap != null)        s.singlePhotoGap          = sp.sectionGap;
        if (cs.enabled != null)           s.cloudStorageEnabled     = cs.enabled;
        if (cs.fallbackToLocal != null)   s.fallbackToLocal         = cs.fallbackToLocal;
        if (adv.qrOverrideUrl)            s.qrOverrideUrl           = adv.qrOverrideUrl;
        if (adv.galleryRefreshInterval != null) s._galleryRefreshInterval = adv.galleryRefreshInterval;
    }

    // ── Routing ───────────────────────────────────────────────────────────────

    setupHashRouting() {
        window.addEventListener('hashchange', () => this.handleUrlHash());
    }

    handleUrlHash() {
        const hash = window.location.hash;
        if (hash.startsWith('#photo=')) {
            const photoId = hash.substring(7);
            this.closeGallery();
            this.showSinglePhoto(photoId);
        } else if (hash === '#gallery-public') {
            this.closeSinglePhotoView();
            this.isPublicGallery      = true;
            this.adminControlsVisible = false;
            this.openGallery();
        } else if (hash === '#gallery') {
            this.closeSinglePhotoView();
            this.isPublicGallery      = false;
            this.adminControlsVisible = true;
            this.openGallery();
        } else {
            this.closeSinglePhotoView();
            this.closeGallery();
        }
    }

    // ── Event listeners ───────────────────────────────────────────────────────

    setupEventListeners() {
        document.addEventListener('keydown', e => {
            if (e.code === 'Space' && !this.countdownActive) {
                e.preventDefault();
                this.triggerPhotoCapture();
            } else if (e.key.toLowerCase() === 'g') {
                this.toggleGallery();
            } else if (e.key.toLowerCase() === 'd') {
                this.toggleDebugPanel();
            } else if (e.key.toLowerCase() === 'x' && this.isPublicGallery) {
                this.adminControlsVisible = !this.adminControlsVisible;
                this.openGallery();
            } else if (e.key === 'Escape') {
                const photoResult = document.getElementById('photoResult');
                if (photoResult?.style.display === 'flex') {
                    if (this.progressAnimation) {
                        try { this.progressAnimation.pause(); } catch (_) {}
                        this.progressAnimation = null;
                    }
                    this.returnToMainView();
                } else {
                    this.closeAllOverlays();
                }
            }
        });

        document.getElementById('cameraSelect')?.addEventListener('change', e => {
            switchCamera(e.target.value, () => applyCameraFilters(this.settings));
        });
    }

    // ── Capture flow ──────────────────────────────────────────────────────────

    triggerPhotoCapture() {
        const galleryOpen     = document.getElementById('galleryOverlay')?.style.display === 'flex';
        const debugOpen       = document.getElementById('debugOverlay')?.style.display  === 'flex';
        const singlePhotoOpen = document.getElementById('singlePhotoView')?.style.display === 'block';

        if (galleryOpen || debugOpen || singlePhotoOpen) {
            console.log('⚠️ Cannot capture — overlay is open');
            return;
        }
        if (this.isCapturing || this.countdownActive) {
            console.log('Already capturing or countdown active');
            return;
        }

        const countdownDisplay = document.getElementById('countdownDisplay');
        if (countdownDisplay) {
            // Show stompbox activation message first, then start countdown after delay
            countdownDisplay.textContent  = this.settings.textStompboxActivated;
            countdownDisplay.style.display = 'block';
            countdownDisplay.style.fontSize = `${this.settings.stompboxFontPX}px`;
            countdownDisplay.style.opacity  = 0;
            countdownDisplay.style.scale    = 0.9;
            anime({ targets: countdownDisplay, opacity: [0,1], scale: [0.9,1], duration: 250, easing: 'easeOutBack' });

            setTimeout(() => {
                runCountdown(
                    countdownDisplay,
                    this.settings,
                    () => this.capturePhoto(),
                    active => { this.countdownActive = active; }
                );
            }, this.settings.stompDelay);
        } else {
            this.capturePhoto();
        }
    }

    async capturePhoto() {
        if (this.isCapturing) {
            console.error('🚫 Already capturing');
            return;
        }

        const now          = Date.now();
        const lockoutMs    = this.settings.captureLockoutSeconds * 1000;
        const sinceCapture = now - this.lastCaptureTime;
        if (this.lastCaptureTime > 0 && sinceCapture < lockoutMs) {
            alert(`Please wait ${Math.round((lockoutMs - sinceCapture) / 1000)} more seconds before taking another photo.`);
            return;
        }

        this.isCapturing     = true;
        this.countdownActive = false;
        this.lastCaptureTime = now;

        try {
            const photoDataUrl = captureFrame(this.settings.photoQuality);
            const photoId      = this.generateUniqueId();

            if (this.photos.some(p => p.id === photoId)) {
                console.error('🚨 Duplicate photo ID:', photoId);
                this.isCapturing = false;
                return;
            }

            const photoData = {
                id:        photoId,
                dataUrl:   photoDataUrl,
                timestamp: new Date().toISOString(),
                settings:  { ...this.settings },
                uploading: true,
                publicUrl: null
            };

            this.photos.push(photoData);
            await this.savePhotosToStorage();

            triggerFlash();
            this.showPhotoResult(photoData);

            if (this.settings.cloudStorageEnabled) {
                uploadPhotoToCloud(
                    photoData,
                    this.settings.fallbackToLocal,
                    this.settings._galleryRefreshInterval
                )
                .then(async () => {
                    await this.savePhotosToStorage();
                    // Update QR codes if this photo is currently on screen
                    if (this.currentPhotoId === photoData.id) {
                        await generateQRCode(photoData.id, this.photos, this.settings.qrOverrideUrl, this.settings.cloudStorageEnabled);
                        const singlePhotoView = document.getElementById('singlePhotoView');
                        if (singlePhotoView?.style.display === 'block') {
                            await generateSinglePhotoQRCode(photoData);
                        }
                    }
                    // Refresh gallery if open
                    const galleryOverlay = document.getElementById('galleryOverlay');
                    if (galleryOverlay?.style.display === 'flex') this.openGallery();
                })
                .catch(err => {
                    console.error('Cloud upload failed:', err);
                    photoData.uploadError = err.message;
                });
            } else {
                photoData.uploading   = false;
                photoData.cloudDisabled = true;
                console.log('☁️ Cloud storage disabled — photo stored locally only');
            }

            setTimeout(() => {
                this.isCapturing = false;
                console.log(`🔓 ${this.settings.captureLockoutSeconds}s lockout complete`);
            }, lockoutMs);

        } catch (err) {
            console.error('❌ Photo capture failed:', err);
            this.isCapturing     = false;
            this.lastCaptureTime = 0;
        }
    }

    // ── Photo result view ─────────────────────────────────────────────────────

    async showPhotoResult(photoData) {
        this.currentPhotoId = photoData.id;

        const capturedPhoto  = document.getElementById('capturedPhoto');
        const photoResult    = document.getElementById('photoResult');
        const cameraContainer= document.querySelector('.camera-container');
        const progressBar    = document.getElementById('progressBar');

        cameraContainer.classList.add('photo-result-active');
        capturedPhoto.src = photoData.dataUrl;

        await generateGalleryQRCode();

        photoResult.style.display = 'flex';

        anime({ targets: photoResult,   opacity: [0,1], duration: 500, easing: 'easeOutQuad' });
        anime({ targets: capturedPhoto, translateX: ['100%','0%'], scale: [0.8,1], duration: 800, easing: 'easeOutBack' });
        anime({ targets: '.qr-section', translateX: ['-100%','0%'], opacity: [0,1], duration: 800, delay: 200, easing: 'easeOutBack' });

        this.progressAnimation = anime({
            targets: progressBar,
            width:   ['0%', '100%'],
            duration: this.settings.progressDuration,
            easing:  'linear',
            complete: () => this.returnToMainView()
        });
    }

    returnToMainView() {
        const photoResult    = document.getElementById('photoResult');
        const cameraContainer= document.querySelector('.camera-container');
        const progressBar    = document.getElementById('progressBar');

        cameraContainer.classList.remove('photo-result-active');
        anime({
            targets: photoResult,
            opacity: [1,0],
            duration: 500,
            easing:  'easeInQuad',
            complete: () => {
                photoResult.style.display = 'none';
                progressBar.style.width   = '0%';
                this.progressAnimation    = null;
            }
        });
    }

    // ── Gallery ───────────────────────────────────────────────────────────────

    toggleGallery() {
        const galleryOverlay = document.getElementById('galleryOverlay');
        galleryOverlay?.style.display === 'flex' ? this.closeGallery() : this.openGallery();
    }

    async openGallery() {
        const galleryOverlay  = document.getElementById('galleryOverlay');
        const galleryHeader   = document.querySelector('.gallery-header');
        const galleryTitle    = document.getElementById('galleryTitle');
        const galleryControls = document.querySelector('.gallery-controls');
        const cameraContainer = document.querySelector('.camera-container');

        if (cameraContainer) cameraContainer.style.display = 'none';

        // Apply gallery background
        if (this.settings.galleryBackgroundImageUrl) {
            galleryOverlay.style.backgroundImage    = `url('${this.settings.galleryBackgroundImageUrl}')`;
            galleryOverlay.style.backgroundSize     = 'cover';
            galleryOverlay.style.backgroundPosition = 'center';
            galleryOverlay.style.backgroundRepeat   = 'no-repeat';
        } else {
            galleryOverlay.style.backgroundImage = 'none';
        }
        galleryOverlay.style.backgroundColor = this.settings.galleryBackgroundColor;

        if (galleryTitle) {
            if (this.isMobile || this.isPublicGallery) {
                galleryTitle.textContent      = this.settings.textBranding || 'Event Photo Gallery';
                galleryTitle.style.fontSize   = this.isMobile ? '22px' : '24px';
                galleryTitle.style.textAlign  = 'center';
                galleryTitle.style.width      = '100%';
                galleryTitle.style.color      = '#ffffff';
                galleryTitle.style.fontWeight = '600';
                galleryTitle.style.display    = 'block';
                galleryTitle.style.lineHeight = '1.4';
            } else {
                galleryTitle.textContent      = 'Photo Gallery';
                galleryTitle.style.fontSize   = '';
                galleryTitle.style.textAlign  = '';
                galleryTitle.style.width      = '';
                galleryTitle.style.color      = '';
                galleryTitle.style.fontWeight = '';
                galleryTitle.style.display    = '';
                galleryTitle.style.lineHeight = '';
            }
        }

        galleryOverlay.style.display = 'flex';

        if (this.settings.cloudStorageEnabled) {
            await this._syncCloudPhotos();

            if (this.isPublicGallery) {
                const baseMs = this.settings._galleryRefreshInterval;
                startGalleryRefresh(async () => {
                    if (!this.isPublicGallery || galleryOverlay.style.display !== 'flex') {
                        stopGalleryRefresh();
                        return this.photos.length;
                    }
                    console.log('🔄 Auto-refreshing gallery...');
                    await this._syncCloudPhotos();
                    renderGalleryGrid(
                        this.photos, this.selectedPhotos,
                        { isPublicGallery: this.isPublicGallery, isMobile: this.isMobile, mobileAdminEnabled: this.mobileAdminEnabled, adminControlsVisible: this.adminControlsVisible },
                        id => this.togglePhotoSelection(id),
                        id => this.deletePhotos([id])
                    );
                    return this.photos.length;
                }, baseMs);
            }
        }

        // Header / controls visibility
        if (this.isMobile) {
            if (galleryHeader) { galleryHeader.style.display = 'flex'; galleryHeader.style.flexDirection = 'column'; galleryHeader.style.alignItems = 'center'; }
            if (galleryControls) galleryControls.style.display = this.mobileAdminEnabled ? 'flex' : 'none';
        } else if (this.isPublicGallery) {
            if (galleryHeader) { galleryHeader.style.display = 'flex'; galleryHeader.style.flexDirection = 'column'; galleryHeader.style.alignItems = 'center'; }
            if (galleryControls) galleryControls.style.display = this.adminControlsVisible ? 'flex' : 'none';
        } else {
            if (galleryHeader)   galleryHeader.style.display   = 'flex';
            if (galleryControls) galleryControls.style.display = 'flex';
        }

        renderGalleryGrid(
            this.photos, this.selectedPhotos,
            { isPublicGallery: this.isPublicGallery, isMobile: this.isMobile, mobileAdminEnabled: this.mobileAdminEnabled, adminControlsVisible: this.adminControlsVisible },
            id => this.togglePhotoSelection(id),
            id => this.deletePhotos([id])
        );

        anime({ targets: galleryOverlay, opacity: [0,1], duration: 300, easing: 'easeOutQuad' });
    }

    closeGallery() {
        const galleryOverlay  = document.getElementById('galleryOverlay');
        const cameraContainer = document.querySelector('.camera-container');

        stopGalleryRefresh();

        if (cameraContainer && !this.isMobile && !this.cameraDisabled) {
            cameraContainer.style.display = '';
        }

        anime({
            targets: galleryOverlay,
            opacity: [1,0],
            duration: 300,
            easing:  'easeInQuad',
            complete: () => { galleryOverlay.style.display = 'none'; }
        });
    }

    // ── Single photo view ─────────────────────────────────────────────────────

    async showSinglePhoto(photoId) {
        const cameraContainer = document.querySelector('.camera-container');
        if (cameraContainer) cameraContainer.style.display = 'none';

        let photo = this.photos.find(p => p.id === photoId);

        if (!photo) {
            try {
                const response = await fetch(`/.netlify/functions/get-photo?id=${encodeURIComponent(photoId)}`);
                if (!response.ok) throw new Error('Photo not found in cloud storage');
                const result = await response.json();
                photo = {
                    id:        result.photoId,
                    publicUrl: result.url,
                    thumbnail: result.thumbnail,
                    timestamp: result.createdAt,
                    dataUrl:   result.url,
                    cloudPhoto: true
                };
            } catch (err) {
                console.error('Failed to fetch photo from cloud:', err);
                const singlePhotoView  = document.getElementById('singlePhotoView');
                document.getElementById('singlePhotoTitle').textContent = 'Photo Not Found';
                document.getElementById('singlePhotoImage').src = '';
                singlePhotoView.style.display = 'block';
                anime({ targets: singlePhotoView, opacity: [0,1], duration: 300, easing: 'easeOutQuad' });
                setTimeout(() => { window.location.hash = ''; }, 3000);
                return;
            }
        }

        this.currentPhotoId = photoId;

        const singlePhotoView  = document.getElementById('singlePhotoView');
        const singlePhotoImage = document.getElementById('singlePhotoImage');
        const singlePhotoTitle = document.getElementById('singlePhotoTitle');
        const shareLink        = document.getElementById('shareLink');

        singlePhotoImage.src      = photo.publicUrl || photo.dataUrl;
        singlePhotoTitle.textContent = photo.cloudPhoto ? `Shared Photo: ${photoId}` : `Photo: ${photoId}`;

        const shareUrl   = photo.publicUrl || `${window.location.origin}${window.location.pathname}#photo=${photoId}`;
        shareLink.value  = shareUrl;

        await generateSinglePhotoQRCode(photo);

        singlePhotoView.style.display = 'block';
        anime({ targets: singlePhotoView, opacity: [0,1], duration: 300, easing: 'easeOutQuad' });
    }

    closeSinglePhotoView() {
        const singlePhotoView  = document.getElementById('singlePhotoView');
        const cameraContainer  = document.querySelector('.camera-container');

        if (window.getComputedStyle(singlePhotoView).display !== 'none') {
            if (cameraContainer && !this.isMobile && !this.cameraDisabled) {
                cameraContainer.style.display = '';
            }
            anime({
                targets: singlePhotoView,
                opacity: [1,0],
                duration: 300,
                easing:  'easeInQuad',
                complete: () => { singlePhotoView.style.display = 'none'; }
            });
        }
    }

    backToGallery()   { window.location.hash = '#gallery'; }

    // ── Debug panel ───────────────────────────────────────────────────────────

    toggleDebugPanel() {
        const debugOverlay = document.getElementById('debugOverlay');
        debugOverlay?.style.display === 'flex' ? this.closeDebugPanel() : this.openDebugPanel();
    }

    openDebugPanel() {
        const debugOverlay = document.getElementById('debugOverlay');
        debugOverlay.style.display = 'flex';
        anime({ targets: debugOverlay, opacity: [0,1], duration: 300, easing: 'easeOutQuad' });
    }

    closeDebugPanel() {
        const debugOverlay = document.getElementById('debugOverlay');
        anime({ targets: debugOverlay, opacity: [1,0], duration: 300, easing: 'easeInQuad',
            complete: () => { debugOverlay.style.display = 'none'; } });
    }

    closeAllOverlays() {
        this.closeGallery();
        this.closeDebugPanel();
    }

    setupDebugPanel() {
        const controls = [
            'stompDelay','countdownDuration','displayDuration','progressDuration',
            'captureLockoutSeconds','photoQuality','brightness','contrast','saturation','hue',
            'showInstructions','showBranding','showKeyHints','showStompboxIndicator',
            'cameraLeft','cameraTop','cameraWidth','countdownSizeVW',
            'countdown3Ms','countdown2Ms','countdown1Ms','countdownSmileHoldMs',
            'instructionsBottomPX','instructionsWidthPercent',
            'qrOverrideUrl','backgroundImageUrl','galleryBackgroundImageUrl','galleryBackgroundColor',
            'textCountdown3','textCountdown2','textCountdown1','textSmile',
            'textStompboxActivated','textBranding','textInstructions','textKeyHints',
            'colorCountdown','colorBranding','colorInstructions','colorKeyHints','colorStompbox',
            'bgColorCountdown','bgColorBranding','bgColorInstructions','bgColorKeyHints','bgColorStompbox',
            'singlePhotoImageHeight','shareButtonsPadding','shareButtonSize','qrCodeSize','singlePhotoGap',
            'cloudStorageEnabled'
        ];

        controls.forEach(control => {
            const element = document.getElementById(control);
            if (!element) return;

            if (element.type === 'checkbox') {
                element.checked = this.settings[control];
                element.addEventListener('change', e => {
                    this.settings[control] = e.target.checked;
                    updateUIElements(this.settings);
                });
            } else if (element.type === 'color') {
                element.value = this.settings[control] || '#ffffff';
                const hexInput = document.getElementById(control + 'Hex');
                if (hexInput) hexInput.value = this.settings[control] || '#ffffff';

                element.addEventListener('input', e => {
                    this.settings[control] = e.target.value;
                    if (hexInput) hexInput.value = e.target.value;
                    updateUIElements(this.settings);
                });

                if (hexInput) {
                    hexInput.addEventListener('input', e => {
                        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                            this.settings[control] = e.target.value;
                            element.value = e.target.value;
                            updateUIElements(this.settings);
                        }
                    });
                }
            } else if (element.type === 'text' || element.type === 'url') {
                element.value = this.settings[control] || '';
                element.addEventListener('input', e => {
                    this.settings[control] = e.target.value;
                    if (control === 'backgroundImageUrl') {
                        updateElementPositions(this.settings);
                    } else if (control === 'galleryBackgroundImageUrl') {
                        const galleryOverlay = document.getElementById('galleryOverlay');
                        if (galleryOverlay?.style.display === 'flex') this.openGallery();
                    } else if (control.startsWith('text')) {
                        updateUIElements(this.settings);
                    }
                });
            } else {
                element.value = this.settings[control];
                element.addEventListener('input', e => {
                    this.settings[control] = parseFloat(e.target.value) || parseInt(e.target.value);
                    this._updateControlValue(control, e.target.value);

                    if (['brightness','contrast','saturation','hue'].includes(control)) {
                        applyCameraFilters(this.settings);
                    } else if (['cameraLeft','cameraTop','cameraWidth','countdownBottomVH','countdownLeftVW','countdownSizeVW','stompboxTopVH','stompboxLeftVW','stompboxFontPX','instructionsBottomPX','instructionsWidthPercent'].includes(control)) {
                        updateElementPositions(this.settings);
                    } else if (['singlePhotoImageHeight','shareButtonsPadding','shareButtonSize','qrCodeSize','singlePhotoGap'].includes(control)) {
                        updateSinglePhotoPageSizing(this.settings);
                    }
                });
                this._updateControlValue(control, this.settings[control]);
            }
        });

        // Background image file upload
        const bgFileInput = document.getElementById('backgroundImageFile');
        if (bgFileInput) {
            bgFileInput.addEventListener('change', e => {
                const file = e.target.files[0];
                if (file?.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = evt => {
                        this.settings.backgroundImageData = evt.target.result;
                        this.settings.backgroundImageUrl  = '';
                        updateElementPositions(this.settings);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Import settings
        const importFileInput = document.getElementById('importSettingsFile');
        if (importFileInput) {
            importFileInput.addEventListener('change', e => {
                const file = e.target.files[0];
                if (file?.type === 'application/json') {
                    const reader = new FileReader();
                    reader.onload = evt => {
                        try {
                            Object.assign(this.settings, JSON.parse(evt.target.result));
                            this.setupDebugPanel();
                            applyCameraFilters(this.settings);
                            updateUIElements(this.settings);
                            updateElementPositions(this.settings);
                            alert('Settings imported successfully!');
                        } catch (err) {
                            alert('Failed to import settings: ' + err.message);
                        }
                    };
                    reader.readAsText(file);
                }
            });
        }
    }

    _updateControlValue(control, value) {
        const el = document.getElementById(control + 'Value');
        if (el) el.textContent = value;
    }

    // ── Mobile admin ──────────────────────────────────────────────────────────

    setupMobileAdminAccess() {
        document.body.addEventListener('click', () => {
            const galleryOverlay  = document.getElementById('galleryOverlay');
            const singlePhotoView = document.getElementById('singlePhotoView');
            if (galleryOverlay?.style.display === 'flex' || singlePhotoView?.style.display === 'block') {
                this.tapCount++;
                clearTimeout(this.tapTimer);
                this.tapTimer = setTimeout(() => { this.tapCount = 0; }, 2000);
                if (this.tapCount === 10) {
                    this.mobileAdminEnabled = !this.mobileAdminEnabled;
                    this.tapCount = 0;
                    alert(this.mobileAdminEnabled ? '🔓 Admin mode enabled!' : '🔒 Admin mode disabled');
                    if (galleryOverlay?.style.display === 'flex') this.openGallery();
                }
            }
        });
    }

    // ── Photo management ──────────────────────────────────────────────────────

    getSelectedPhotos()        { return this.photos.filter(p => this.selectedPhotos.has(p.id)); }
    selectAllPhotos()          { this.photos.forEach(p => this.selectedPhotos.add(p.id)); this._refreshGallerySelection(); }
    clearSelection()           { this.selectedPhotos.clear(); this._refreshGallerySelection(); }
    togglePhotoSelection(id)   {
        this.selectedPhotos.has(id) ? this.selectedPhotos.delete(id) : this.selectedPhotos.add(id);
        this._refreshGallerySelection();
    }

    _refreshGallerySelection() {
        this.photos.forEach(photo => {
            const item = document.querySelector(`[data-photo-id="${photo.id}"]`);
            if (item) {
                const cb = item.querySelector('.selection-checkbox');
                if (cb) cb.checked = this.selectedPhotos.has(photo.id);
            }
        });
    }

    async deleteSelectedPhotos() {
        const ids = Array.from(this.selectedPhotos);
        if (ids.length === 0) { alert('No photos selected'); return; }
        if (confirm(`Delete ${ids.length} photo(s)? This cannot be undone.`)) {
            await this.deletePhotos(ids);
        }
    }

    async deletePhotos(photoIds) {
        try {
            const loadingMsg = document.createElement('div');
            loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--overlay-bg);padding:30px;border-radius:12px;z-index:10000;text-align:center;';
            loadingMsg.innerHTML = '<h3>Deleting photos...</h3><p>Please wait</p>';
            document.body.appendChild(loadingMsg);

            const response = await fetch('/.netlify/functions/delete-photo', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ photoIds })
            });

            document.body.removeChild(loadingMsg);

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const result = await response.json();
            console.log('✅ Delete result:', result);

            this.photos = this.photos.filter(p => !photoIds.includes(p.id));
            photoIds.forEach(id => this.selectedPhotos.delete(id));
            await this.savePhotosToStorage();

            const galleryGrid = document.getElementById('galleryGrid');
            if (galleryGrid) {
                renderGalleryGrid(
                    this.photos, this.selectedPhotos,
                    { isPublicGallery: this.isPublicGallery, isMobile: this.isMobile, mobileAdminEnabled: this.mobileAdminEnabled, adminControlsVisible: this.adminControlsVisible },
                    id => this.togglePhotoSelection(id),
                    id => this.deletePhotos([id])
                );
            }

            alert(`Successfully deleted ${result.deleted} photo(s)`);
        } catch (err) {
            console.error('❌ Delete failed:', err);
            alert(`Failed to delete photos: ${err.message}`);
        }
    }

    generateUniqueId() {
        this.photoCounter++;
        return `Photo-${Date.now()}-${this.photoCounter}`;
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    async savePhotosToStorage() {
        try {
            const photosData = this.photos.map(p => ({
                id:           p.id,
                dataUrl:      (p.publicUrl || p.cloudDisabled) ? undefined : p.dataUrl,
                timestamp:    p.timestamp,
                settings:     p.settings,
                publicUrl:    p.publicUrl,
                thumbnail:    p.thumbnail,
                uploading:    p.uploading,
                uploadSuccess: p.uploadSuccess,
                uploadError:  p.uploadError,
                cloudDisabled: p.cloudDisabled
            }));
            localStorage.setItem('photobooth-photos', JSON.stringify(photosData));
            updateSystemStatus('storageStatus', `Storage: ${this.photos.length} photos`, 'success');
        } catch (err) {
            console.error('⚠️ Storage save failed:', err.message);
            this.photos.forEach(p => { if (p.publicUrl) delete p.dataUrl; });
            try {
                localStorage.setItem('photobooth-photos', JSON.stringify(
                    this.photos.map(p => ({ id: p.id, dataUrl: p.dataUrl, timestamp: p.timestamp, publicUrl: p.publicUrl, thumbnail: p.thumbnail, uploading: p.uploading, uploadSuccess: p.uploadSuccess, uploadError: p.uploadError, cloudDisabled: p.cloudDisabled }))
                ));
                updateSystemStatus('storageStatus', `Storage: ${this.photos.length} photos (cleaned)`, 'success');
            } catch (_) {
                updateSystemStatus('storageStatus', 'Storage: Quota exceeded', 'error');
            }
        }
    }

    async loadPhotosFromStorage() {
        try {
            const stored = localStorage.getItem('photobooth-photos');
            if (stored) {
                this.photos = JSON.parse(stored);
                console.log('✅ Loaded photos from localStorage:', this.photos.length);
            }
            if (this.settings.cloudStorageEnabled) {
                await this._syncCloudPhotos();
            }
            updateSystemStatus('storageStatus', `Storage: ${this.photos.length} photos loaded`, 'success');
        } catch (err) {
            console.error('Storage load failed:', err);
            updateSystemStatus('storageStatus', 'Storage: Error', 'error');
        }
    }

    async _syncCloudPhotos() {
        if (this.isFetchingPhotos) {
            console.log('⏭️ Skipping fetch — already in progress');
            return;
        }
        this.isFetchingPhotos = true;
        try {
            const cloudPhotos = await fetchPhotosFromCloud();
            const existingIds = new Set(this.photos.map(p => p.id));
            const newPhotos   = cloudPhotos.filter(p => !existingIds.has(p.id));

            this.photos = this.photos.map(local => {
                const cloud = cloudPhotos.find(cp => cp.id === local.id);
                return cloud ? { ...local, ...cloud, dataUrl: local.dataUrl || cloud.dataUrl } : local;
            });

            this.photos = [...this.photos, ...newPhotos];
            this.photos.sort((a, b) => b.timestamp - a.timestamp);
        } catch (err) {
            console.error('❌ Failed to fetch from cloud:', err);
        } finally {
            this.isFetchingPhotos = false;
        }
    }

    // ── Cloud status ──────────────────────────────────────────────────────────

    async checkCloudStorageStatus() {
        const cloudStatus = document.getElementById('cloudStatus');
        if (!cloudStatus) return;

        if (!this.settings.cloudStorageEnabled) {
            cloudStatus.className = 'status-indicator status-warning';
            cloudStatus.innerHTML = '<span>●</span> Cloud: Disabled (Local Only)';
            return;
        }

        try {
            const response = await fetch('/.netlify/functions/get-photo?id=test');
            if (response.status === 404 || response.status === 400) {
                cloudStatus.className = 'status-indicator status-success';
                cloudStatus.innerHTML = '<span>●</span> Cloud: Connected';
            } else if (response.status === 500) {
                const body = await response.json().catch(() => ({}));
                cloudStatus.className = 'status-indicator status-error';
                cloudStatus.innerHTML = `<span>●</span> Cloud: Error — ${body.error || 'Check credentials'}`;
                if (body.hint) showErrorToast(body.hint);
            }
        } catch (_) {
            cloudStatus.className = 'status-indicator status-warning';
            cloudStatus.innerHTML = '<span>●</span> Cloud: Unavailable (Local dev?)';
        }
    }

    // ── Sharing ───────────────────────────────────────────────────────────────

    shareToTwitter() {
        const shareUrl = document.getElementById('shareLink')?.value;
        const text     = encodeURIComponent('Check out this photo! @Event');
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
    }

    shareToFacebook() {
        const shareUrl = document.getElementById('shareLink')?.value;
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
    }

    copyInstagramLink() {
        const photo = this.photos.find(p => p.id === this.currentPhotoId);
        if (!photo) return;
        if (this.isMobile) {
            window.location.href = 'instagram://camera';
            setTimeout(() => window.open('https://www.instagram.com/', '_blank'), 1500);
        } else {
            const shareUrl = document.getElementById('shareLink')?.value;
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('Link copied! Open Instagram and paste in your post.');
            });
        }
    }

    downloadCurrentPhoto() {
        const photo = this.photos.find(p => p.id === this.currentPhotoId);
        if (!photo) return;
        const link      = document.createElement('a');
        link.href       = photo.publicUrl || photo.dataUrl;
        link.download   = `Photo_${photo.id}.jpg`;
        link.click();
    }

    copyShareLink() {
        const shareLink = document.getElementById('shareLink');
        shareLink?.select();
        navigator.clipboard.writeText(shareLink?.value).then(() => {
            alert('Link copied to clipboard!');
        });
    }

    // ── Settings export / import ──────────────────────────────────────────────

    exportSettings() {
        const dataStr  = JSON.stringify({ ...this.settings, timestamp: new Date().toISOString(), version: '2.0' }, null, 2);
        const blob     = new Blob([dataStr], { type: 'application/json' });
        const url      = URL.createObjectURL(blob);
        const link     = document.createElement('a');
        link.href      = url;
        link.download  = `photobooth-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert('Settings exported!');
    }

    resetToDefaults() {
        // Re-instantiate defaults by merging the default constructor object
        this.settings = {
            stompDelay:1000,countdownDuration:3,displayDuration:12000,progressDuration:15000,
            captureLockoutSeconds:10,photoQuality:0.92,resolution:'1920x1080',
            brightness:0,contrast:100,saturation:100,hue:0,
            cameraLeft:50,cameraTop:50,cameraWidth:87,showInstructions:true,showBranding:true,
            showKeyHints:true,showStompboxIndicator:true,
            countdownBottomVH:12,countdownLeftVW:50,countdownSizeVW:8,
            countdownStepMs:2000,countdownSmileHoldMs:1000,
            stompboxTopVH:75,stompboxLeftVW:40,stompboxFontPX:25,
            instructionsBottomPX:17,instructionsWidthPercent:40,
            qrOverrideUrl:'',backgroundImageUrl:'',backgroundImageData:'',
            galleryBackgroundImageUrl:'',galleryBackgroundColor:'#ffffff',
            countdown3Ms:1000,countdown2Ms:1000,countdown1Ms:1000,
            textCountdown3:'3',textCountdown2:'2',textCountdown1:'1',textSmile:'Smile!',
            textStompboxActivated:'📸 Stompbox Activated - Get Ready!',
            textBranding:'Event Photobooth',
            textInstructions:'Step lightly on the stompbox to snap a photo, then wait for the QR code!',
            textKeyHints:"Press 'G' for Gallery • 'D' for Debug • Spacebar to simulate stompbox",
            colorCountdown:'#ffffff',colorBranding:'#212121',colorInstructions:'#212121',
            colorKeyHints:'#212121',colorStompbox:'#212121',
            bgColorCountdown:'#1976d2',bgColorBranding:'#f5f5f6',bgColorInstructions:'#f5f5f6',
            bgColorKeyHints:'#f5f5f6',bgColorStompbox:'#f5f5f6',
            singlePhotoImageHeight:80,shareButtonsPadding:40,shareButtonSize:16,qrCodeSize:400,singlePhotoGap:60,
            cloudStorageEnabled:true,fallbackToLocal:true
        };
        this.setupDebugPanel();
        applyCameraFilters(this.settings);
        updateUIElements(this.settings);
        updateElementPositions(this.settings);
        updateSinglePhotoPageSizing(this.settings);
    }

    // ── Test helpers (debug panel) ────────────────────────────────────────────
    testCountdown()    { if (!this.countdownActive) { const el = document.getElementById('countdownDisplay'); if (el) runCountdown(el, this.settings, () => {}, a => { this.countdownActive = a; }); } }
    testPhotoCapture() { if (!this.isCapturing && !this.countdownActive) this.triggerPhotoCapture(); }
    testQRGeneration() { generateQRCode('test_' + Date.now(), this.photos, this.settings.qrOverrideUrl, this.settings.cloudStorageEnabled); }
}

// ── Global functions used by inline onclick handlers in index.html ────────────
// These stay at module level so they're reachable on the window object via the
// global function declarations below.

let photoBoothApp;

document.addEventListener('DOMContentLoaded', () => {
    photoBoothApp = new PhotoBoothApp();
    // Expose on window so inline HTML onclick="photoBoothApp.xxx()" handlers work
    window.photoBoothApp = photoBoothApp;
});

// These must be on window explicitly for onclick="" attributes
window.closeGallery       = () => photoBoothApp?.closeGallery();
window.closeDebugPanel    = () => photoBoothApp?.closeDebugPanel();
window.testCountdown      = () => photoBoothApp?.testCountdown();
window.testPhotoCapture   = () => photoBoothApp?.testPhotoCapture();
window.testQRGeneration   = () => photoBoothApp?.testQRGeneration();
window.exportSettings     = () => photoBoothApp?.exportSettings();
window.importSettings     = () => document.getElementById('importSettingsFile')?.click();
window.resetToDefaults    = () => { if (confirm('Reset all settings to defaults?')) photoBoothApp?.resetToDefaults(); };
window.exportSelected     = () => {
    if (!photoBoothApp?.photos.length) { alert('No photos to export!'); return; }
    const selected = photoBoothApp.getSelectedPhotos();
    if (!selected.length) { alert('No photos selected for export!'); return; }
    selected.forEach(photo => {
        const ts   = new Date(photo.timestamp);
        const name = `Photo-${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}.jpg`;
        const link = Object.assign(document.createElement('a'), { href: photo.dataUrl, download: name, style: 'display:none' });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    alert(`Exported ${selected.length} photo(s) successfully!`);
};
window.clearGallery = () => {
    if (confirm('Clear all photos? This cannot be undone.')) {
        photoBoothApp.photos = [];
        photoBoothApp.savePhotosToStorage();
        photoBoothApp.openGallery();
    }
};
