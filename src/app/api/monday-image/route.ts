// src/app/api/monday-image/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Cache to reduce API requests
const imageCache = new Map<string, { data: ArrayBuffer, contentType: string, timestamp: number }>();
const CACHE_TIMEOUT = 900000; // 15 minutes

function logInfo(message: string, data?: any) {
  console.log(`[MONDAY-PROXY] ${message}`, data ? JSON.stringify(data) : '');
}

// Function to get public asset URL through GraphQL API
async function getPublicAssetUrl(assetId: string, token: string): Promise<string | null> {
  try {
    const graphqlQuery = {
      query: `
        query {
          assets(ids: [${assetId}]) {
            id
            url
            public_url
          }
        }
      `
    };

    logInfo(`Executing GraphQL query for asset URL: ${assetId}`);

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify(graphqlQuery)
    });

    if (!response.ok) {
      logInfo(`GraphQL API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.errors) {
      logInfo('GraphQL returned errors:', data.errors);
      return null;
    }
    
    if (data.data?.assets?.length > 0) {
      const asset = data.data.assets[0];
      logInfo('Asset data retrieved:', asset);
      
      // Try public_url first, then url
      return asset.public_url || asset.url || null;
    } else {
      logInfo('Asset not found in API response');
      return null;
    }
  } catch (error:any) {
    logInfo(`Error getting public URL: ${error.message}`);
    return null;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const assetId = searchParams.get('id') || '';
  const skipCache = searchParams.get('t') !== null;
  const token = process.env.MONDAY_TOKEN;

  logInfo(`Request received for: ${imageUrl?.substring(0, 100)}...`);

  if (!imageUrl) {
    return new Response('Missing image URL', { status: 400 });
  }

  if (!token) {
    return new Response('Missing API token', { status: 500 });
  }

  // Create cache key
  const cacheKey = imageUrl;

  // Check cache unless skip requested
  if (!skipCache && imageCache.has(cacheKey)) {
    const cachedData = imageCache.get(cacheKey)!;
    const now = Date.now();
    
    // Use cached data if not expired
    if (now - cachedData.timestamp < CACHE_TIMEOUT) {
      logInfo(`Using cached version for: ${imageUrl?.substring(0, 50)}...`);
      
      return new Response(cachedData.data, {
        headers: {
          'Content-Type': cachedData.contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT'
        }
      });
    } else {
      // Remove expired data
      imageCache.delete(cacheKey);
    }
  }

  try {
    // Extract resource ID from URL if not provided
    let resourceId = assetId;
    if (!resourceId && imageUrl.includes('/resources/')) {
      const match = imageUrl.match(/\/resources\/(\d+)\//);
      if (match && match[1]) {
        resourceId = match[1];
        logInfo(`Extracted resource ID from URL: ${resourceId}`);
      }
    }

    if (!resourceId) {
      logInfo('Could not extract asset ID');
      return new Response('Could not extract asset ID', { status: 400 });
    }

    // Get public URL through GraphQL API
    const publicApiUrl = await getPublicAssetUrl(resourceId, token);
    
    if (publicApiUrl) {
      logInfo(`Public URL obtained via API: ${publicApiUrl}`);
      
      try {
        const imageResponse = await fetch(publicApiUrl, { cache: 'no-store' });
        
        if (imageResponse.ok) {
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          const imageData = await imageResponse.arrayBuffer();
          
          // Save to cache
          imageCache.set(cacheKey, {
            data: imageData,
            contentType,
            timestamp: Date.now()
          });
          
          logInfo(`Successfully loaded image via official API URL: ${imageData.byteLength} bytes`);
          
          return new Response(imageData, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*',
              'X-Source': 'MondayAPI'
            }
          });
        } else {
          logInfo(`Error loading from public API URL: ${imageResponse.status}`);
        }
      } catch (e:any) {
        logInfo(`Error loading from public API URL: ${e.message}`);
      }
    }

    // If API method failed, try file download API
    const fileDownloadUrl = `https://files.monday.com/file/download/${resourceId}`;
    logInfo(`Trying download URL: ${fileDownloadUrl}`);

    const fileResponse = await fetch(fileDownloadUrl, {
      headers: {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store'
    });

    if (fileResponse.ok) {
      const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
      const imageData = await fileResponse.arrayBuffer();
      
      // Save to cache
      imageCache.set(cacheKey, {
        data: imageData,
        contentType,
        timestamp: Date.now()
      });
      
      logInfo(`Successfully retrieved file via download URL: ${imageData.byteLength} bytes`);
      
      return new Response(imageData, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'X-Source': 'FileAPI'
        }
      });
    }

    // Try direct request as last resort
    logInfo(`Direct request to URL: ${imageUrl}`);
    
    const directResponse = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `monday_token=${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'image/*, */*'
      },
      cache: 'no-store'
    });
    
    if (!directResponse.ok) {
      logInfo(`Error with direct request: ${directResponse.status}`);
      return new Response(`Failed to fetch image: ${directResponse.status}`, { 
        status: directResponse.status 
      });
    }
    
    const contentType = directResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await directResponse.arrayBuffer();
    
    // Save to cache
    imageCache.set(cacheKey, {
      data: imageData,
      contentType,
      timestamp: Date.now()
    });
    
    logInfo(`Successfully retrieved file via direct request: ${imageData.byteLength} bytes`);
    
    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Source': 'DirectURL'
      }
    });
  } catch (error: any) {
    logInfo(`Error fetching image: ${error.message}`);
    return new Response(`Error fetching image: ${error.message}`, { status: 500 });
  }
}