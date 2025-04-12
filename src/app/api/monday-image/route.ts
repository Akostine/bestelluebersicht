// src/app/api/monday-image/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Функция для расширенного логирования
function logInfo(message: string, data?: any) {
  console.log(`[MONDAY-PROXY] ${message}`, data ? JSON.stringify(data) : '');
}

// Функция для отправки запроса с таймаутом
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 8000): Promise<Response> {
  // Создаем контроллер для прерывания запроса по таймауту
  const controller = new AbortController();
  const { signal } = controller;
  
  // Добавляем сигнал к опциям запроса
  const fetchOptions = { ...options, signal };
  
  // Создаем таймер для прерывания запроса
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  // Получаем URL изображения из параметра запроса
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const token = process.env.MONDAY_TOKEN;

  logInfo(`Получен запрос для: ${imageUrl}`);

  if (!imageUrl) {
    logInfo('Отсутствует URL изображения');
    return new Response('Missing image URL', { status: 400 });
  }

  if (!token) {
    logInfo('Отсутствует API токен');
    return new Response('Missing API token', { status: 500 });
  }

  try {
    // Извлекаем ID ресурса из URL
    let assetId = '';
    if (imageUrl.includes('/resources/')) {
      const match = imageUrl.match(/\/resources\/(\d+)\//);
      if (match && match[1]) {
        assetId = match[1];
        logInfo(`Извлечен ID ресурса: ${assetId}`);
      }
    }

    if (!assetId) {
      logInfo('Не удалось извлечь ID ресурса из URL');
      return new Response('Could not extract asset ID from URL', { status: 400 });
    }

    // Пробуем использовать новый API для публичного доступа к файлам
    const publicFileUrl = `https://api.monday.com/v2/file/${assetId}/public-url`;
    logInfo(`Пытаемся получить публичный URL для файла: ${publicFileUrl}`);

    try {
      const publicUrlResponse = await fetchWithTimeout(publicFileUrl, {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      }, 5000); // 5 секунд таймаут

      if (publicUrlResponse.ok) {
        const publicUrlData = await publicUrlResponse.json();
        logInfo('Получен ответ для публичного URL:', publicUrlData);
        
        if (publicUrlData && publicUrlData.data && publicUrlData.data.url) {
          const publicUrl = publicUrlData.data.url;
          logInfo(`Получен публичный URL: ${publicUrl}`);
          
          // Перенаправляем на публичный URL
          return NextResponse.redirect(publicUrl);
        }
      }
    } catch (e:any) {
      logInfo('Ошибка при получении публичного URL:', { error: e.message });
      // Продолжаем с другими методами
    }

    // Пробуем использовать File Download API Monday.com
    const fileDownloadUrl = `https://files.monday.com/file/download/${assetId}`;
    logInfo(`Пытаемся загрузить файл по URL: ${fileDownloadUrl}`);

    try {
      const fileResponse = await fetchWithTimeout(fileDownloadUrl, {
        headers: {
          'Authorization': token,
          'User-Agent': 'Mozilla/5.0 (compatible; NeonDisplay/1.0)'
        },
        cache: 'no-store'
      }, 5000); // 5 секунд таймаут

      if (fileResponse.ok) {
        // Получаем данные из первого успешного запроса
        const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
        const imageData = await fileResponse.arrayBuffer();
        
        logInfo(`Успешно получен файл: ${imageData.byteLength} байт, тип: ${contentType}`);
        
        return new Response(imageData, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      logInfo(`Ошибка загрузки файла: ${fileResponse.status} ${fileResponse.statusText}`);
    } catch (e:any) {
      logInfo('Ошибка при загрузке файла:', { error: e.message });
      // Продолжаем с другими методами
    }

    // Попробуем второй вариант URL
    const alternativeUrl = `https://files.monday.com/files/${assetId}`;
    logInfo(`Пробуем альтернативный URL: ${alternativeUrl}`);
    
    try {
      const alternativeResponse = await fetchWithTimeout(alternativeUrl, {
        headers: {
          'Authorization': token,
          'User-Agent': 'Mozilla/5.0 (compatible; NeonDisplay/1.0)'
        },
        cache: 'no-store'
      }, 5000); // 5 секунд таймаут

      if (alternativeResponse.ok) {
        // Используем данные из альтернативного запроса
        const contentType = alternativeResponse.headers.get('content-type') || 'image/jpeg';
        const imageData = await alternativeResponse.arrayBuffer();
        
        logInfo(`Успешно получен файл через альтернативный запрос: ${imageData.byteLength} байт, тип: ${contentType}`);
        
        return new Response(imageData, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      logInfo(`Альтернативный запрос не удался: ${alternativeResponse.status}`);
    } catch (e:any) {
      logInfo('Ошибка при альтернативном запросе:', { error: e.message });
      // Продолжаем с другими методами
    }
    
    // Последняя попытка - прямой запрос к исходному URL
    logInfo(`Выполняем прямой запрос к исходному URL: ${imageUrl}`);
    
    try {
      const directResponse = await fetchWithTimeout(imageUrl, {
        headers: {
          'Authorization': token,
          'Cookie': `monday_token=${token}`,
          'User-Agent': 'Mozilla/5.0 (compatible; NeonDisplay/1.0)',
          'Accept': 'image/*, */*'
        },
        cache: 'no-store'
      }, 5000); // 5 секунд таймаут

      if (directResponse.ok) {
        // Получаем данные из прямого запроса
        const contentType = directResponse.headers.get('content-type') || 'image/jpeg';
        const imageData = await directResponse.arrayBuffer();
        
        logInfo(`Успешно получен файл через прямой запрос: ${imageData.byteLength} байт, тип: ${contentType}`);
        
        return new Response(imageData, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      logInfo(`Прямой запрос не удался: ${directResponse.status}`);
    } catch (e:any) {
      logInfo('Ошибка при прямом запросе:', { error: e.message });
    }

    // Если все методы не сработали, возвращаем ошибку
    logInfo('Все попытки не удались');
    return new Response('Failed to fetch image after multiple attempts', { status: 500 });
  } catch (error: any) {
    logInfo('Ошибка при получении изображения:', { error: error.message });
    return new Response(`Error fetching image: ${error.message}`, { status: 500 });
  }
}