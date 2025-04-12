// src/lib/monday-api.ts
import mondaySdk from 'monday-sdk-js';

export interface OrderData {
  id: string;
  name: string;
  mockupUrl: string;
  deadline: string | null;
  status: string;
  ledLength: number;
  wasserdicht: boolean;
  versandart: string;
  completedStages: string[];
  // Note: fernbedienung is always true, so we don't need to fetch it from the API
}

export async function fetchOrders(): Promise<OrderData[]> {
  const res = await fetch('/api/refresh');
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `Status ${res.status}`);
  }
  const { orders } = await res.json();
  return orders;
}

export const initServerMondayClient = (token: string) => {
  const mondayServer = mondaySdk();
  mondayServer.setToken(token);
  return mondayServer;
};

// Execute a GraphQL query with proper error handling
export const executeServerQuery = async (
  token: string,
  query: string,
  variables?: Record<string, any>
): Promise<{
  data?: any;
  errors?: Array<{ message: string }>;
  status_code?: number;
}> => {
  const mondayClient = initServerMondayClient(token);
  
  try {
    // Execute the query with provided variables
    const response = await mondayClient.api(query, { variables });
    return response;
  } catch (error: any) {
    console.error('Monday SDK server error:', error);
    return {
      errors: [{ message: error.message || 'Unknown error' }],
      status_code: 500
    };
  }
};

// Helper function to directly query a specific board
export const getBoard = async (
  token: string, 
  boardId: string | number
): Promise<any> => {
  // According to the docs, this is the recommended query structure
  const query = `
    query {
      boards(ids: ${boardId}) {
        id
        name
        columns {
          id
          title
          type
        }
        items_page(limit: 50) {
          items {
            id
            name
            column_values {
              id
              title
              text
              value
            }
          }
        }
      }
    }
  `;
  
  return executeServerQuery(token, query);
};