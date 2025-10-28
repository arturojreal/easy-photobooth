# Easy Photobooth 📸

A modern, interactive photobooth application with cloud storage, QR code sharing, and real-time photo gallery. Perfect for events, conferences, parties, and any occasion where you want to capture and share memories instantly.

[![Ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/arturojreal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Live Camera Feed**: Real-time video preview with adjustable filters and positioning
- **Countdown Timer**: Customizable countdown sequence before photo capture
- **Cloud Storage**: Automatic upload to Cloudinary for persistent storage and sharing
- **QR Code Sharing**: Instant QR codes for easy photo and gallery access
- **Photo Gallery**: Browse, select, and manage all captured photos
- **Social Sharing**: Share directly to Twitter/X, Facebook, and Instagram
- **Mobile Responsive**: Optimized for both desktop kiosks and mobile devices
- **Debug Panel**: Comprehensive settings panel for real-time customization
- **Export Functionality**: Download individual photos or batch export selections

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- A Cloudinary account (free tier available at [cloudinary.com](https://cloudinary.com))
- Netlify account for deployment (optional, for cloud functions)

### Installation

1. **Clone or download this repository**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Cloudinary**:
   - Copy `env.example` to `.env`
   - Add your Cloudinary credentials from your dashboard
   ```bash
   cp env.example .env
   ```
   
   Edit `.env`:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_FOLDER=photobooth
   ```

4. **Customize your event** (optional):
   - Edit `config.js` to customize branding, text, colors, and timing
   - Replace background images if desired

5. **Run locally**:
   ```bash
   npm run dev
   ```
   
   Open `http://localhost:8888` in your browser

### Deployment

Deploy to Netlify for full functionality including cloud storage:

```bash
npm run deploy
```

Or connect your repository to Netlify for automatic deployments.

## Configuration

### Basic Configuration (`config.js`)

The `config.js` file contains all customizable parameters:

```javascript
const PHOTOBOOTH_CONFIG = {
    branding: {
        eventName: "My Event 2025",
        galleryTitle: "Event Photo Gallery",
        photoPrefix: "Event",
        backgroundImage: "",
        galleryBackgroundImage: "",
        galleryBackgroundColor: "#42208F"
    },
    
    social: {
        twitterHandle: "@MyEvent",
        hashtag: "#MyEvent",
        shareMessage: "Check out this photo from the event!"
    },
    
    timing: {
        stompboxDelay: 1000,
        countdown3Duration: 1000,
        countdown2Duration: 1000,
        countdown1Duration: 1000,
        smileHoldDuration: 1000,
        photoDisplayDuration: 12000,
        progressBarDuration: 15000,
        captureLockoutSeconds: 10
    },
    
    // ... more configuration options
};
```

### Environment Variables

Set these in your `.env` file (local) or Netlify environment variables (production):

- `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Your Cloudinary API key
- `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
- `CLOUDINARY_FOLDER`: Folder name in Cloudinary (default: "photobooth")

## Usage

### Taking Photos

1. **Desktop/Kiosk Mode**:
   - Press `Spacebar` or connect a physical button/pedal
   - Watch the countdown
   - Photo is captured and displayed with QR code

2. **Mobile Mode**:
   - Mobile devices automatically redirect to gallery view
   - Photos taken on the kiosk appear in real-time

### Keyboard Shortcuts

- `Spacebar`: Trigger photo capture
- `G`: Open/close gallery
- `D`: Open/close debug panel
- `X`: Toggle admin controls in public gallery mode
- `ESC`: Close overlays or skip photo display

### Gallery Features

- **Public Gallery**: Access via QR code (`#gallery-public`)
- **Admin Gallery**: Full controls (`#gallery`)
- **Select Multiple**: Choose photos for batch operations
- **Export**: Download selected photos
- **Delete**: Remove photos from cloud storage
- **Auto-refresh**: Gallery updates every 10 seconds in public mode

### Debug Panel

Press `D` to access the debug panel with controls for:

- Camera settings (brightness, contrast, saturation, hue)
- Element positioning (camera, countdown, instructions)
- Timing adjustments
- Text customization
- Color schemes
- Background images
- Cloud storage toggle
- Export/import settings

## File Structure

```
interactive-photobooth/
├── index.html          # Main HTML structure
├── styles.css          # All CSS styles
├── app.js              # Application logic
├── config.js           # Configuration file
├── package.json        # Dependencies
├── netlify.toml        # Netlify configuration
├── .env                # Environment variables (create from env.example)
├── env.example         # Environment variables template
├── netlify/
│   └── functions/      # Serverless functions
│       ├── upload-photo.js
│       ├── list-photos.js
│       ├── get-photo.js
│       └── delete-photo.js
└── README.md           # This file
```

## Customization Guide

### Changing Branding

1. Edit `config.js`:
   ```javascript
   branding: {
       eventName: "Your Event Name",
       galleryTitle: "Your Gallery Title"
   }
   ```

2. Update social media handles:
   ```javascript
   social: {
       twitterHandle: "@YourHandle",
       hashtag: "#YourHashtag"
   }
   ```

### Adding Background Images

1. Place your image in the project directory
2. Update `config.js`:
   ```javascript
   branding: {
       backgroundImage: "your-background.jpg",
       galleryBackgroundImage: "your-gallery-bg.jpg"
   }
   ```

### Adjusting Timing

Modify countdown and display durations in `config.js`:

```javascript
timing: {
    countdown3Duration: 1500,  // 1.5 seconds for "3"
    countdown2Duration: 1500,  // 1.5 seconds for "2"
    countdown1Duration: 1500,  // 1.5 seconds for "1"
    smileHoldDuration: 2000,   // 2 seconds for "Smile!"
    photoDisplayDuration: 15000, // 15 seconds to show photo
    captureLockoutSeconds: 15    // 15 seconds between captures
}
```

### Changing Colors

Update the color scheme in `config.js`:

```javascript
colors: {
    countdown: "#ffffff",
    branding: "#00ff00",
    instructions: "#ffff00"
}
```

## Hardware Integration

### Physical Button/Pedal

Connect a USB button or foot pedal that simulates a spacebar press. The application will automatically trigger photo capture.

Recommended hardware:
- USB foot pedal switches
- Large arcade-style buttons
- Wireless remote triggers

### Camera Setup

For best results:
- Use a high-quality webcam (1080p or higher)
- Position camera at eye level
- Ensure good lighting
- Test camera settings in debug panel

## Troubleshooting

### Photos Not Uploading

1. Check Cloudinary credentials in `.env`
2. Verify environment variables in Netlify
3. Check browser console for errors
4. Ensure `cloudStorageEnabled` is `true` in config

### Camera Not Working

1. Grant camera permissions in browser
2. Check if camera is being used by another application
3. Try a different browser (Chrome recommended)
4. Check camera selection in debug panel

### QR Codes Not Generating

1. Ensure photos are uploaded to Cloudinary
2. Check that public URLs are being generated
3. Verify QR code library is loaded (check browser console)

### Gallery Not Refreshing

1. Check cloud storage is enabled
2. Verify Netlify functions are deployed
3. Check browser console for API errors

## Browser Support

- **Recommended**: Chrome/Chromium (best camera support)
- **Supported**: Firefox, Safari, Edge
- **Mobile**: iOS Safari, Chrome for Android

## Performance Tips

1. **Photo Quality**: Adjust `photoQuality` in config (0.85-0.95 recommended)
2. **Resolution**: Use 1920x1080 for most cases
3. **Local Storage**: Photos are automatically cleaned from localStorage after cloud upload
4. **Gallery Size**: Cloudinary automatically generates optimized thumbnails

## Security Notes

- Never commit `.env` file to version control
- Use Netlify environment variables for production
- Cloudinary credentials should be kept secret
- Consider adding authentication for admin features in production

## Support This Project ☕

If you find Easy Photobooth useful and would like to support its development, consider buying me a coffee!

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/arturojreal)

Your support helps maintain and improve this project. Thank you! 🙏

## Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your events!

## Credits

Built with:
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) - QR code generation
- [Anime.js](https://animejs.com/) - Smooth animations
- [Cloudinary](https://cloudinary.com/) - Cloud storage and image optimization
- [Netlify](https://www.netlify.com/) - Serverless functions and hosting

## Support & Help

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/arturojreal/easy-photobooth/issues)
- Check existing documentation
- Review the debug panel for diagnostics

If you'd like to support the project financially:
- [Buy me a coffee on Ko-fi](https://ko-fi.com/arturojreal) ☕

## Changelog

### Version 1.0.0
- Initial release
- Core photobooth functionality
- Cloud storage integration
- QR code sharing
- Gallery management
- Debug panel
- Mobile responsive design

---

**Enjoy your event! 📸**
