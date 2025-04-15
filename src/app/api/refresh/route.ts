// src/app/api/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeServerQuery } from '@/lib/monday-api';

export const runtime = 'edge';

interface Column {
  id: string;
  title: string;
  type: string;
}

interface ColumnValue {
  id: string;
  text: string;
  value: string;
  type: string;
}

interface Item {
  id: string;
  name: string;
  column_values: ColumnValue[];
}

interface Board {
  name: string;
  columns: Column[];
  items_page: {
    items: Item[];
  };
}

interface ApiResponse {
  data?: {
    boards?: Board[];
  };
  errors?: Array<{ message: string }>;
}

interface StageDefinition {
  stage: string;
  matches: string[];
}

interface Order {
  id: string;
  name: string;
  mockupUrl: string;
  deadline: string | null;
  status: string;
  ledLength: number;
  wasserdicht: boolean;
  versandart: string;
  completedStages: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = process.env.MONDAY_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;
  
  if (!token || !boardId) {
    return NextResponse.json(
      { error: 'Missing API token or board ID' },
      { status: 400 }
    );
  }

  // GraphQL запрос для получения данных о заказах
  const query = `
    query {
      boards(ids: [${boardId}]) {
        name
        columns {
          id
          title
          type
        }
        items_page(limit: 100) {
          items {
            id
            name
            column_values {
              id
              text
              value
              type
            }
          }
        }
      }
    }
  `;

  try {
    // Выполнение запроса
    const response: ApiResponse = await executeServerQuery(token, query);

    // Обработка ошибок API
    if (response.errors) {
      console.error('Monday.com API errors:', response.errors);
      return NextResponse.json(
        { error: response.errors[0].message },
        { status: 400 }
      );
    }

    // Проверка структуры ответа
    if (!response.data?.boards || response.data.boards.length === 0) {
      console.log('API Response:', JSON.stringify(response, null, 2));
      return NextResponse.json(
        { 
          error: 'No boards found', 
          details: 'The API returned successfully but no boards were found with the provided ID',
          boardId: boardId
        },
        { status: 404 }
      );
    }

    // Получаем данные доски и колонок
    const board = response.data.boards[0];
    const columns = board.columns || [];
    
    // Выводим все колонки для отладки
    console.log('All columns:', columns.map(col => ({ 
      id: col.id, 
      title: col.title, 
      type: col.type 
    })));

    // Создаем карту колонок для быстрого доступа
    const columnMap: Record<string, { id: string; type: string; title: string }> = {};
    columns.forEach(col => {
      if (col && col.title) {
        // Нормализация заголовка (в нижний регистр, замена пробелов и специальных символов)
        const normalizedTitle = col.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        columnMap[normalizedTitle] = {
          id: col.id,
          type: col.type,
          title: col.title
        };
        columnMap[col.id] = {
          id: col.id,
          type: col.type,
          title: col.title
        };
      }
    });

    console.log('Column mapping:', columnMap);

    // Получаем элементы (заказы) из доски
    const items = board.items_page?.items || [];
    
    if (items.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    // Define the production stages with all possible variations
    // This helps with case insensitive matching
    const stageSequence: StageDefinition[] = [
      { stage: 'CNC', matches: ['cnc', 'фрезеровка'] },
      { stage: 'LED', matches: ['led', 'лед'] },
      { stage: 'Silikon', matches: ['silikon', 'silicon', 'силикон'] },
      { stage: 'UV Print', matches: ['uv print', 'uv', 'печать', 'увпечать'] },
      { stage: 'Lack', matches: ['lack', 'лак'] },
      { stage: 'Verpackung', matches: ['verpackung', 'verpacken', 'упаковка'] },
    ];

    const orders: Order[] = items.map(item => {
      // Выводим ID всех колонок и их значения для отладки
      console.log(`All column IDs for item ${item.id} :`, 
        item.column_values.map(c => `${c.id} (${c.text})`).join(', ')
      );

      // Функция для получения значения колонки по ID или заголовку
      const getColumnValue = (idOrTitle: string): string => {
        if (!idOrTitle) return '';
        
        // Прямой поиск по ID колонки
        const col = item.column_values.find(c => c.id === idOrTitle);
        if (col) return col.text || '';
        
        // Поиск через нормализованный заголовок
        try {
          const normalizedSearch = idOrTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const mappedCol = columnMap[normalizedSearch];
          if (mappedCol) {
            const found = item.column_values.find(c => c.id === mappedCol.id);
            return found ? found.text || '' : '';
          }
        } catch (e) {
          console.warn(`Error in getting column value for ${idOrTitle}:`, e);
        }
        
        return '';
      };

      // Функция для получения JSON-значения колонки
      const getJsonValue = (idOrTitle: string): any => {
        if (!idOrTitle) return null;
        
        // Прямой поиск по ID колонки
        const col = item.column_values.find(c => c.id === idOrTitle);
        if (col && col.value) {
          try {
            return JSON.parse(col.value);
          } catch (e) {
            console.warn(`Failed to parse JSON for column ${idOrTitle}:`, e);
            return null;
          }
        }
        
        // Поиск через нормализованный заголовок
        try {
          const normalizedSearch = idOrTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const mappedCol = columnMap[normalizedSearch];
          if (mappedCol) {
            const found = item.column_values.find(c => c.id === mappedCol.id);
            if (found && found.value) {
              try {
                return JSON.parse(found.value);
              } catch (e) {
                console.warn(`Failed to parse JSON for mapped column ${idOrTitle} -> ${mappedCol.id}:`, e);
                return null;
              }
            }
          }
        } catch (e) {
          console.warn(`Error in getting JSON value for ${idOrTitle}:`, e);
        }
        
        return null;
      };

      // Получение статуса и определение завершенных этапов
      const status = getColumnValue('status') || '';
      const statusLower = status.toLowerCase().trim();
      
      // Определяем индекс текущего этапа в последовательности
      let currentStageIndex = -1;
      
      // Ищем индекс текущего этапа с учетом всех возможных вариантов написания
      for (let i = 0; i < stageSequence.length; i++) {
        if (stageSequence[i].matches.some(match => statusLower.includes(match))) {
          currentStageIndex = i;
          break;
        }
      }
      
      console.log(`Order ${item.id} status: "${status}" matched to stage index: ${currentStageIndex}`);
      
      // Определение завершенных этапов
      let completedStages: string[] = [];
      
      if (currentStageIndex > 0) {
        // Если текущая стадия не первая, то все предыдущие стадии уже завершены
        completedStages = stageSequence.slice(0, currentStageIndex).map(s => s.stage);
      }
      
      // Если статус "Abholbereit" или "Fertig", все этапы завершены
      if (statusLower.includes('abholbereit') || statusLower.includes('fertig') || 
          statusLower.includes('готов') || statusLower.includes('выполнен')) {
        completedStages = stageSequence.map(s => s.stage);
      }
      
      console.log(`Order ${item.id} completed stages:`, completedStages);

      // Получение URL изображения Mock-Up
      let mockupUrl = '';
      
      // Ищем колонку файла Mock-Up (на основе маппинга колонок)
      const mockupColumnId = columnMap.mock_up?.id || 'file_mkpxcy3z';
      
      // Получаем значение колонки
      const mockupColumn = item.column_values.find(c => c.id === mockupColumnId);
      
      // Если нашли колонку с изображением и у нее есть значение
      if (mockupColumn && mockupColumn.value) {
        try {
          const mockupJson = JSON.parse(mockupColumn.value);
          
          // Извлекаем URL из структуры JSON
          if (mockupJson.files && mockupJson.files.length > 0) {
            mockupUrl = mockupJson.files[0].url || '';
            console.log(`Found mockup URL in column ${mockupColumnId}`);
          }
        } catch (e) {
          console.warn(`Failed to parse mock-up JSON:`, e);
        }
      }
      
      // Если URL из основной колонки не найден, используем текстовое значение
      if (!mockupUrl && mockupColumn && mockupColumn.text) {
        mockupUrl = mockupColumn.text;
      }

      // Получение длины LED-ленты
      let ledLength = 0;
      try {
        // Ищем колонку с длиной LED на основе маппинга
        const ledColumnId = columnMap.led_l_nge?.id || 'numeric_mkpxsm0s';
        const ledColumn = item.column_values.find(c => c.id === ledColumnId);
        
        // Парсим значение, учитывая запятую как разделитель десятичных чисел
        if (ledColumn && ledColumn.text) {
          ledLength = parseFloat(ledColumn.text.replace(',', '.')) || 0;
        }
      } catch (e) {
        console.warn(`Error parsing LED length:`, e);
      }

      // Определяем, является ли знак водонепроницаемым
      let isWasserdicht = false;
      try {
        const wasserdichtColumnId = columnMap.wasserdicht__?.id || 'color_mkpx96t2';
        const wasserdichtColumn = item.column_values.find(c => c.id === wasserdichtColumnId);
        
        if (wasserdichtColumn) {
          const wasserdichtText = wasserdichtColumn.text || '';
          isWasserdicht = wasserdichtText.toLowerCase() === 'ja' || 
                          wasserdichtText.toLowerCase() === 'yes' ||
                          wasserdichtText.toLowerCase() === 'true';
        }
      } catch (e) {
        console.warn(`Error determining wasserdicht status:`, e);
      }

      // Получаем значение Versandart
      let versandart = '';
      try {
        const versandartColumnId = columnMap.versandart?.id || 'color_mkpxdbea';
        const versandartColumn = item.column_values.find(c => c.id === versandartColumnId);
        
        if (versandartColumn) {
          versandart = versandartColumn.text || '';
        }
      } catch (e) {
        console.warn(`Error getting versandart:`, e);
      }

      // Создаем объект заказа
      return {
        id: item.id,
        name: item.name,
        mockupUrl: mockupUrl,
        deadline: getColumnValue('deadline') || getColumnValue('datum') || null,
        status: status,
        ledLength: ledLength,
        wasserdicht: isWasserdicht,
        versandart: versandart,
        completedStages: completedStages
      };
    });

    // Фильтрация заказов - исключаем заказы со статусом "Abholbereit" или "Versendet"
    const filteredOrders = orders.filter(order => {
      const orderStatus = order.status.toLowerCase();
      return orderStatus !== 'abholbereit' && orderStatus !== 'versendet';
    });
    
    console.log(`Общее количество заказов: ${orders.length}, после фильтрации: ${filteredOrders.length}`);

    // Сортируем отфильтрованные заказы по дедлайну (ближайшие сначала)
    const sortedOrders = filteredOrders.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    return NextResponse.json({ 
      orders: sortedOrders,
      _meta: {
        boardName: board.name,
        itemCount: items.length,
        filteredCount: sortedOrders.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Unknown error occurred',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}