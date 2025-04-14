// src/app/api/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeServerQuery } from '@/lib/monday-api';

export const runtime = 'edge';

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
    const response = await executeServerQuery(token, query);

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
            //@ts-ignore

    console.log('All columns:', columns.map(col => ({ 
      id: col.id, 
      title: col.title, 
      type: col.type 
    })));

    // Создаем карту колонок для быстрого доступа
            //@ts-ignore

    const columnMap: Record<string, any> = {};
            //@ts-ignore

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

           //@ts-ignore

    const orders = items.map(item => {
      // Выводим ID всех колонок и их значения для отладки
      console.log(`All column IDs for item ${item.id} :`, 
                //@ts-ignore

        item.column_values.map(c => `${c.id} (${c.text})`).join(', ')
      );

      // Функция для получения значения колонки по ID или заголовку
      const getColumnValue = (idOrTitle: string): string => {
        if (!idOrTitle) return '';
        
        // Прямой поиск по ID колонки
                //@ts-ignore

        const col = item.column_values.find(c => c.id === idOrTitle);
        if (col) return col.text || '';
        
        // Поиск через нормализованный заголовок
        try {
          const normalizedSearch = idOrTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const mappedCol = columnMap[normalizedSearch];
          if (mappedCol) {
                    //@ts-ignore

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
        //@ts-ignore
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
                    //@ts-ignore

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
      const stages = ['CNC', 'LED', 'SILIKON', 'UV Print', 'Lack', 'Verpackung'];
      
      // Для завершенных этапов находим текущий этап и включаем все предыдущие
      let completedStages: string[] = [];
      const currentStageIndex = stages.findIndex(stage => 
        stage.toLowerCase() === status.toLowerCase()
      );
      
      if (currentStageIndex >= 0) {
        completedStages = stages.slice(0, currentStageIndex + 1);
      } else if (status.toLowerCase() === 'abholbereit') {
        // Если статус "Abholbereit", все этапы завершены
        completedStages = [...stages];
      }

      // Получение URL изображения Mock-Up
      let mockupUrl = '';
      
      // Ищем колонку файла Mock-Up (на основе маппинга колонок)
      const mockupColumnId = columnMap.mock_up?.id || 'file_mkpxcy3z';
      
      // Получаем значение колонки
              //@ts-ignore

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
                //@ts-ignore

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
                //@ts-ignore

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
                //@ts-ignore

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

    // Сортируем заказы по дедлайну (ближайшие сначала)
            //@ts-ignore

    const sortedOrders = orders.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    // Отфильтровываем заказы со статусом "Abholbereit" и перемещаем их в конец
            //@ts-ignore

    const pendingOrders = sortedOrders.filter(order => order.status !== 'Abholbereit');
            //@ts-ignore

    const completedOrders = sortedOrders.filter(order => order.status === 'Abholbereit');
    
    const finalOrders = [...pendingOrders, ...completedOrders];

    return NextResponse.json({ 
      orders: finalOrders,
      _meta: {
        boardName: board.name,
        itemCount: items.length,
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