const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { image, photoId, metadata } = JSON.parse(event.body);

    if (!image || !photoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing image or photoId' })
      };
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(image, {
      public_id: `xr-photobooth/${photoId}`,
      folder: 'xr-photobooth',
      resource_type: 'image',
      tags: ['xr-photobooth', 'motion-capture']
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        photoId: photoId,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        thumbnail: cloudinary.url(uploadResult.public_id, {
          width: 400,
          height: 400,
          crop: 'fill',
          quality: 'auto'
        })
      })
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to upload photo',
        message: error.message 
      })
    };
  }
};
