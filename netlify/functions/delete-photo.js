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
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { photoIds } = body; // Array of photo IDs to delete

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'photoIds array is required' })
      };
    }

    console.log(`Deleting ${photoIds.length} photo(s):`, photoIds);

    const folderName = process.env.CLOUDINARY_FOLDER || 'photobooth';

    // Convert photo IDs to Cloudinary public IDs
    // Add prefix only if not already present
    const publicIds = photoIds.map(id => {
      // If ID already has the prefix, use as-is
      if (id.startsWith(`${folderName}/`)) {
        return id;
      }
      // Otherwise add the prefix
      return `${folderName}/${folderName}/${id}`;
    });

    console.log('Cloudinary public IDs to delete:', publicIds);

    // Delete photos from Cloudinary
    const deleteResult = await cloudinary.api.delete_resources(publicIds, {
      resource_type: 'image'
    });

    console.log('Delete result:', deleteResult);

    // Count successful deletions
    const deleted = Object.values(deleteResult.deleted).filter(status => status === 'deleted').length;
    const notFound = Object.values(deleteResult.deleted).filter(status => status === 'not_found').length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        deleted: deleted,
        notFound: notFound,
        total: photoIds.length,
        details: deleteResult.deleted
      })
    };
  } catch (error) {
    console.error('Delete photo error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to delete photos',
        message: error.message 
      })
    };
  }
};
