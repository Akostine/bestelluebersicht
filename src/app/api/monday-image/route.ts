// src/app/api/monday-image/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Кэш для уменьшения запросов к API
const imageCache = new Map<string, { data: ArrayBuffer, contentType: string, timestamp: number }>();
const CACHE_TIMEOUT = 900000; // 15 минут

function logInfo(message: string, data?: any) {
  console.log(`[MONDAY-PROXY] ${message}`, data ? JSON.stringify(data) : '');
}

// Функция для получения публичного URL файла через GraphQL API
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

    logInfo(`Выполняем GraphQL запрос для получения URL ресурса: ${assetId}`);

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify(graphqlQuery)
    });

    if (!response.ok) {
      logInfo(`GraphQL API ответил с ошибкой: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.errors) {
      logInfo('GraphQL вернул ошибки:', data.errors);
      return null;
    }
    
    if (data.data?.assets?.length > 0) {
      const asset = data.data.assets[0];
      logInfo('Получены данные о ресурсе:', asset);
      
      // Сначала пробуем получить public_url, затем обычный url
      return asset.public_url || asset.url || null;
    } else {
      logInfo('Ресурс не найден в ответе API');
      return null;
    }
  } catch (error:any) {
    logInfo(`Ошибка при получении публичного URL: ${error.message}`);
    return null;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const assetId = searchParams.get('id') || '';
  const skipCache = searchParams.get('t') !== null;
  const token = process.env.MONDAY_TOKEN;

  logInfo(`Получен запрос для: ${imageUrl?.substring(0, 100)}...`);

  if (!imageUrl) {
    return new Response('Missing image URL', { status: 400 });
  }

  if (!token) {
    return new Response('Missing API token', { status: 500 });
  }

  // Создаем ключ для кэша
  const cacheKey = imageUrl;

  // Проверяем кэш, если не запрошено пропустить кэш
  if (!skipCache && imageCache.has(cacheKey)) {
    const cachedData = imageCache.get(cacheKey)!;
    const now = Date.now();
    
    // Используем кэшированные данные, если они не устарели
    if (now - cachedData.timestamp < CACHE_TIMEOUT) {
      logInfo(`Используем кэшированную версию для: ${imageUrl?.substring(0, 50)}...`);
      
      return new Response(cachedData.data, {
        headers: {
          'Content-Type': cachedData.contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT'
        }
      });
    } else {
      // Удаляем устаревшие данные
      imageCache.delete(cacheKey);
    }
  }

  try {
    // Извлекаем ID ресурса из URL, если он не был передан как параметр
    let resourceId = assetId;
    if (!resourceId && imageUrl.includes('/resources/')) {
      const match = imageUrl.match(/\/resources\/(\d+)\//);
      if (match && match[1]) {
        resourceId = match[1];
        logInfo(`Извлечен ID ресурса из URL: ${resourceId}`);
      }
    }

    if (!resourceId) {
      logInfo('Не удалось извлечь ID ресурса');
      return new Response('Could not extract asset ID', { status: 400 });
    }

    // НОВЫЙ КОД: Получаем публичный URL через GraphQL API
    const publicApiUrl = await getPublicAssetUrl(resourceId, token);
    
    if (publicApiUrl) {
      logInfo(`Получен публичный URL через API: ${publicApiUrl}`);
      
      try {
        const imageResponse = await fetch(publicApiUrl, { cache: 'no-store' });
        
        if (imageResponse.ok) {
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          const imageData = await imageResponse.arrayBuffer();
          
          // Сохраняем в кэш
          imageCache.set(cacheKey, {
            data: imageData,
            contentType,
            timestamp: Date.now()
          });
          
          logInfo(`Успешно загружено изображение через официальный API URL: ${imageData.byteLength} байт`);
          
          return new Response(imageData, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*',
              'X-Source': 'MondayAPI'
            }
          });
        } else {
          logInfo(`Ошибка при загрузке через публичный API URL: ${imageResponse.status}`);
        }
      } catch (e:any) {
        logInfo(`Ошибка при загрузке через публичный API URL: ${e.message}`);
      }
    }

    // Если API метод не сработал, пробуем файловый API
    const fileDownloadUrl = `https://files.monday.com/file/download/${resourceId}`;
    logInfo(`Пробуем download URL: ${fileDownloadUrl}`);

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
      
      // Сохраняем в кэш
      imageCache.set(cacheKey, {
        data: imageData,
        contentType,
        timestamp: Date.now()
      });
      
      logInfo(`Успешно получен файл через download URL: ${imageData.byteLength} байт`);
      
      return new Response(imageData, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'X-Source': 'FileAPI'
        }
      });
    }

    // Пробуем прямой запрос в последнюю очередь
    logInfo(`Прямой запрос к URL: ${imageUrl}`);
    
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
      logInfo(`Ошибка при прямом запросе: ${directResponse.status}`);
      return new Response(`Failed to fetch image: ${directResponse.status}`, { 
        status: directResponse.status 
      });
    }
    
    const contentType = directResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await directResponse.arrayBuffer();
    
    // Сохраняем в кэш
    imageCache.set(cacheKey, {
      data: imageData,
      contentType,
      timestamp: Date.now()
    });
    
    logInfo(`Успешно получен файл через прямой запрос: ${imageData.byteLength} байт`);
    
    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Source': 'DirectURL'
      }
    });
  } catch (error: any) {
    logInfo(`Ошибка при получении изображения: ${error.message}`);
    return new Response(`Error fetching image: ${error.message}`, { status: 500 });
  }
}