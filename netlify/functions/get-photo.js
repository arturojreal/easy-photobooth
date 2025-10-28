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
    const photoId = event.queryStringParameters?.id;

    if (!photoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing photo ID' })
      };
    }

    const folderName = process.env.CLOUDINARY_FOLDER || 'photobooth';

    // Get resource details from Cloudinary
    const result = await cloudinary.api.resource(`${folderName}/${photoId}`, {
      resource_type: 'image'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        photoId: photoId,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        createdAt: result.created_at,
        metadata: result.context?.custom?.metadata ? JSON.parse(result.context.custom.metadata) : null,
        thumbnail: cloudinary.url(result.public_id, {
          width: 400,
          height: 400,
          crop: 'fill',
          quality: 'auto'
        })
      })
    };
  } catch (error) {
    console.error('Get photo error:', error);
    
    if (error.error?.http_code === 404) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Photo not found',
          message: 'This photo does not exist or may have been deleted'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to retrieve photo',
        message: error.message 
      })
    };
  }
};
