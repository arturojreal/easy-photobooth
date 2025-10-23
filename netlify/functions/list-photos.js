const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const maxResults = parseInt(event.queryStringParameters?.max_results || '50');
    const nextCursor = event.queryStringParameters?.next_cursor;

    // List resources from Cloudinary
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'xr-photobooth/',
      max_results: Math.min(maxResults, 100),
      next_cursor: nextCursor,
      resource_type: 'image'
    });

    const photos = result.resources.map(resource => {
      // Extract clean photo ID by removing all instances of the prefix
      let photoId = resource.public_id;
      // Remove all occurrences of 'xr-photobooth/' prefix
      while (photoId.includes('xr-photobooth/')) {
        photoId = photoId.replace('xr-photobooth/', '');
      }
      
      return {
        photoId: photoId,
        url: resource.secure_url,
        publicId: resource.public_id,
        width: resource.width,
        height: resource.height,
        format: resource.format,
        createdAt: resource.created_at,
        thumbnail: cloudinary.url(resource.public_id, {
          width: 400,
          height: 400,
          crop: 'fill',
          quality: 'auto'
        })
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        photos: photos,
        total: result.resources.length,
        nextCursor: result.next_cursor || null
      })
    };
  } catch (error) {
    console.error('List photos error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to list photos',
        message: error.message 
      })
    };
  }
};
