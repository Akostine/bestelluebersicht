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
}

export async function fetchOrders(): Promise<OrderData[]> {
  try {
    const res = await fetch('/api/refresh', {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Status ${res.status}`);
    }
    
    const { orders } = await res.json();
    return orders;
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

export const initServerMondayClient = (token: string) => {
  const mondayServer = mondaySdk();
  mondayServer.setToken(token);
  return mondayServer;
};

// Execute a GraphQL query with proper error handling and rate limiting
export const executeServerQuery = async (
  token: string,
  query: string,
  variables?: Record<string, any>
): Promise<{
  data?: any;
  errors?: Array<{ message: string }>;
  status_code?: number;
}> => {
  // Create Monday client
  const mondayClient = initServerMondayClient(token);
  
  // Add delay to avoid rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    // Add proper headers for API request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': token,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // Try direct fetch approach first with proper headers
    try {
      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query, variables }),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (directFetchError) {
      console.warn('Direct fetch failed, falling back to SDK', directFetchError);
      // Wait before retrying with SDK to avoid rate limiting
      await delay(500);
    }

    // Fall back to SDK if direct fetch fails
    const options = variables ? { variables } : undefined;
    const response = await mondayClient.api(query, options);
    
    return response;
  } catch (error: any) {
    console.error('Monday API server error:', error);
    
    // Add delay before throwing to avoid rapid retries on error
    await delay(1000);
    
    return {
      errors: [{ message: error.message || 'Unknown error' }],
      status_code: 500
    };
  }
};

// Helper function to directly query a specific board with retry logic
export const getBoard = async (
  token: string, 
  boardId: string | number
): Promise<any> => {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      // Recommended query structure with minimal fields to reduce payload size
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
                  text
                  value
                }
              }
            }
          }
        }
      `;
      
      const response = await executeServerQuery(token, query);
      return response;
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Add exponential backoff delay
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If all retries fail, throw the last error
  throw lastError || new Error('Failed to fetch board after multiple retries');
};