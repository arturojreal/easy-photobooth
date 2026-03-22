const cloudinary = require('cloudinary').v2;

// ── Runtime environment validation ────────────────────────────────────────────
// Checked on every cold-start so missing credentials surface immediately with
// a clear, actionable error rather than a cryptic Cloudinary SDK failure.
const REQUIRED_ENV = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Validate required env vars before touching Cloudinary
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Missing required environment variables: ' + missing.join(', '),
        hint:  'Set these in your Netlify dashboard under Site Settings > Environment Variables.'
      })
    };
  }

  try {
    const { image, photoId, metadata } = JSON.parse(event.body);

    if (!image || !photoId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing image or photoId' }) };
    }

    const folderName = process.env.CLOUDINARY_FOLDER || 'photobooth';

    const uploadResult = await cloudinary.uploader.upload(image, {
      public_id:     `${folderName}/${photoId}`,
      folder:        folderName,
      resource_type: 'image',
      tags:          ['photobooth', 'event-photos']
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:   true,
        photoId:   photoId,
        url:       uploadResult.secure_url,
        publicId:  uploadResult.public_id,
        thumbnail: cloudinary.url(uploadResult.public_id, {
          width: 400, height: 400, crop: 'fill', quality: 'auto'
        })
      })
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to upload photo', message: error.message })
    };
  }
};
