/**
 * Photobooth Configuration
 *
 * This file contains all customizable parameters for the photobooth application.
 * Modify these values to customize the experience for your event.
 * See .env.example for required Cloudinary environment variables.
 */

// ============================================================
// SETUP REQUIRED — Change these values before your event
// ============================================================
// eventName        — Displayed in the gallery header
// overlayImage     — Path to your event's overlay PNG (or leave empty)
// cloudStorage     — Set enabled: true and add Cloudinary env vars
// colors           — Match your event branding
// See .env.example for required environment variables
// ============================================================

const PHOTOBOOTH_CONFIG = {
    // Event Branding
    branding: {
        eventName: "Your Event Name",             // <-- CHANGE THIS
        galleryTitle: "Event Photo Gallery",
        photoPrefix: "Event",
        backgroundImage: "",                      // URL to background image or leave empty
        galleryBackgroundImage: "",               // URL to gallery background or leave empty
        galleryBackgroundColor: "#ffffff"         // <-- CHANGE THIS
    },

    // Social Media
    social: {
        twitterHandle: "@YourEvent",              // <-- CHANGE THIS
        hashtag: "#YourEvent",                    // <-- CHANGE THIS
        shareMessage: "Check out this photo from the event!"
    },

    // Timing Settings (in milliseconds unless specified)
    timing: {
        stompboxDelay: 1000,        // Delay after trigger before countdown starts
        countdown3Duration: 1000,   // Duration to show "3"
        countdown2Duration: 1000,   // Duration to show "2"
        countdown1Duration: 1000,   // Duration to show "1"
        smileHoldDuration: 1000,    // Duration to show "Smile!"
        photoDisplayDuration: 12000,// How long to show captured photo
        progressBarDuration: 15000, // Progress bar duration
        captureLockoutSeconds: 10   // Minimum seconds between captures
    },

    // Camera Settings
    camera: {
        photoQuality: 0.92,         // JPEG quality (0.1 to 1.0)
        resolution: '1920x1080',    // Default resolution
        brightness: 0,              // -100 to 100
        contrast: 100,              // 50 to 200
        saturation: 100,            // 0 to 200
        hue: 0                      // -180 to 180
    },

    // UI Positioning (viewport units)
    positioning: {
        cameraLeft: 50,             // % from left
        cameraTop: 50,              // % from top
        cameraWidth: 87,            // % width
        countdownBottom: 12,        // vh from bottom
        countdownLeft: 50,          // vw from left
        countdownSize: 8,           // vw font size
        stompboxTop: 80,            // vh from top
        stompboxLeft: 50,           // vw from left
        stompboxFontSize: 25,       // px
        instructionsBottom: 17,     // px from bottom
        instructionsWidth: 40       // % width
    },

    // UI Text Content
    text: {
        countdown3: "3",
        countdown2: "2",
        countdown1: "1",
        smile: "Smile!",
        stompboxActivated: "Get Ready!",
        instructions: "Press the button to take a photo!",
        keyHints: "Press 'G' for Gallery • 'D' for Debug • Spacebar to capture"
    },

    // UI Colors (hex codes)
    colors: {
        countdown: "#ffffff",
        branding: "#212121",        // <-- CHANGE THIS
        instructions: "#212121",
        keyHints: "rgba(33, 33, 33, 0.6)",
        stompbox: "#212121"
    },

    // Background Colors for UI Elements
    backgroundColors: {
        countdown: "#1976d2",
        branding: "#f5f5f6",
        instructions: "#f5f5f6",
        keyHints: "#f5f5f6",
        stompbox: "#f5f5f6"
    },

    // Visibility Toggles
    visibility: {
        showInstructions: true,
        showBranding: true,
        showKeyHints: true,
        showStompboxIndicator: true
    },

    // Single Photo Page Settings
    singlePhotoPage: {
        imageHeight: 80,            // vh
        shareButtonsPadding: 40,    // px
        shareButtonSize: 16,        // px
        qrCodeSize: 400,            // px
        sectionGap: 60              // px
    },

    // Cloud Storage
    cloudStorage: {
        enabled: true,              // Set to false for local-only mode  <-- CHANGE THIS if needed
        folder: "photobooth",       // Cloudinary upload folder name
        fallbackToLocal: true       // If upload fails, save photo to browser localStorage
                                    // Set to false to prompt attendee to retake instead
    },

    // Advanced Settings
    advanced: {
        qrOverrideUrl: "",          // Override QR code URL (leave empty for auto)
        autoRefreshGallery: true,   // Auto-refresh gallery using adaptive backoff
        galleryRefreshInterval: 10000 // Base polling interval in ms (backs off to 60s when idle)
    }
};

// CommonJS export for local dev / testing environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PHOTOBOOTH_CONFIG;
}
