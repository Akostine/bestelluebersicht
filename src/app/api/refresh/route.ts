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

  // GraphQL query for fetching order data
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
    // Execute the query
    const response = await executeServerQuery(token, query);

    // Handle API errors
    if (response.errors) {
      console.error('Monday.com API errors:', response.errors);
      return NextResponse.json(
        { error: response.errors[0].message },
        { status: 400 }
      );
    }

    // Check response structure
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

    // Get board data and columns
    const board = response.data.boards[0];
    const columns = board.columns || [];
    
    // Create column map for easy access
    const columnMap: Record<string, any> = {};
    columns.forEach((col: any) => {
      if (col && col.title) {
        // Normalize title (lowercase, replace spaces and special chars)
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

    // Get items (orders) from the board
    const items = board.items_page?.items || [];
    
    if (items.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const orders = items.map((item: any) => {
      // Helper function to get column value by ID or title
      const getColumnValue = (idOrTitle: string): string => {
        if (!idOrTitle) return '';
        
        // Direct search by column ID
        const col = item.column_values.find((c: any) => c.id === idOrTitle);
        if (col) return col.text || '';
        
        // Search by normalized title
        try {
          const normalizedSearch = idOrTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const mappedCol = columnMap[normalizedSearch];
          if (mappedCol) {
            const found = item.column_values.find((c: any) => c.id === mappedCol.id);
            return found ? found.text || '' : '';
          }
        } catch (e) {
          console.warn(`Error in getting column value for ${idOrTitle}:`, e);
        }
        
        return '';
      };

      // Helper function to get JSON value
      const getJsonValue = (idOrTitle: string): any => {
        if (!idOrTitle) return null;
        
        // Direct search by column ID
        const col = item.column_values.find((c: any) => c.id === idOrTitle);
        if (col && col.value) {
          try {
            return JSON.parse(col.value);
          } catch (e) {
            console.warn(`Failed to parse JSON for column ${idOrTitle}:`, e);
            return null;
          }
        }
        
        // Search by normalized title
        try {
          const normalizedSearch = idOrTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const mappedCol = columnMap[normalizedSearch];
          if (mappedCol) {
            const found = item.column_values.find((c: any) => c.id === mappedCol.id);
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

      // Get status and determine completed stages
      const status = getColumnValue('status') || '';
      const stages = ['CNC', 'LED', 'SILIKON', 'UV Print', 'Lack', 'Verpackung'];
      
      // For completed stages, find current stage and include all previous
      let completedStages: string[] = [];
      const currentStageIndex = stages.findIndex(stage => 
        stage.toLowerCase() === status.toLowerCase()
      );
      
      if (currentStageIndex >= 0) {
        completedStages = stages.slice(0, currentStageIndex + 1);
      } else if (status.toLowerCase() === 'abholbereit') {
        // If status is "Abholbereit", all stages are complete
        completedStages = [...stages];
      }

      // Get mockup URL
      let mockupUrl = '';
      
      // Find file column for mockup
      const mockupColumnId = columnMap.mock_up?.id || 'file';
      
      // Get column value
      const mockupColumn = item.column_values.find((c: any) => c.id === mockupColumnId);
      
      // If found column with image and it has a value
      if (mockupColumn && mockupColumn.value) {
        try {
          const mockupJson = JSON.parse(mockupColumn.value);
          
          // Extract URL from JSON structure
          if (mockupJson.files && mockupJson.files.length > 0) {
            mockupUrl = mockupJson.files[0].url || '';
          }
        } catch (e) {
          console.warn(`Failed to parse mock-up JSON:`, e);
        }
      }
      
      // If URL not found in main column, use text value
      if (!mockupUrl && mockupColumn && mockupColumn.text) {
        mockupUrl = mockupColumn.text;
      }

      // Get LED length
      let ledLength = 0;
      try {
        // Find column for LED length
        const ledColumnId = columnMap.led_l_nge?.id || 'led_länge' || 'numeric';
        const ledColumn = item.column_values.find((c: any) => c.id === ledColumnId || c.title?.toLowerCase().includes('led'));
        
        // Parse value, handle comma as decimal separator
        if (ledColumn && ledColumn.text) {
          ledLength = parseFloat(ledColumn.text.replace(',', '.')) || 0;
        }
      } catch (e) {
        console.warn(`Error parsing LED length:`, e);
      }

      // Determine if wasserdicht
      let isWasserdicht = false;
      try {
        const wasserdichtColumnId = columnMap.wasserdicht?.id || 'wasserdicht';
        const wasserdichtColumn = item.column_values.find((c: any) => 
          c.id === wasserdichtColumnId || 
          c.title?.toLowerCase().includes('wasserdicht')
        );
        
        if (wasserdichtColumn) {
          const wasserdichtText = wasserdichtColumn.text || '';
          isWasserdicht = wasserdichtText.toLowerCase() === 'ja' || 
                        wasserdichtText.toLowerCase() === 'yes' ||
                        wasserdichtText.toLowerCase() === 'true';
        }
      } catch (e) {
        console.warn(`Error determining wasserdicht status:`, e);
      }

      // Get versandart
      let versandart = '';
      try {
        const versandartColumnId = columnMap.versandart?.id || 'versandart';
        const versandartColumn = item.column_values.find((c: any) => 
          c.id === versandartColumnId || 
          c.title?.toLowerCase().includes('versand')
        );
        
        if (versandartColumn) {
          versandart = versandartColumn.text || '';
        }
      } catch (e) {
        console.warn(`Error getting versandart:`, e);
      }

      // Create order object
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

    // Sort orders by deadline (closest first)
    const sortedOrders = orders.sort((a: any, b: any) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    // Filter orders with status "Abholbereit" and move them to end
    const pendingOrders = sortedOrders.filter((order: any) => order.status !== 'Abholbereit');
    const completedOrders = sortedOrders.filter((order: any) => order.status === 'Abholbereit');
    
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