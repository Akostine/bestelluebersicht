// src/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { OrderData } from '@/lib/monday-api';
import OrderCard from '@/components/OrderCard/OrderCard';
import styles from './page.module.css';

export default function Home() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Use the API route
      const response = await fetch('/api/refresh', {
        // Add cache: 'no-store' to prevent caching
        cache: 'no-store',
        next: { revalidate: 0 }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.orders) {
        throw new Error('Invalid response format from API');
      }
      
      setOrders(data.orders);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(`Failed to load orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle manual refresh
  const handleRefresh = () => {
    loadOrders();
  };

  useEffect(() => {
    // Initial load
    loadOrders();
    
    // Set up auto-refresh every 60 seconds
    const intervalId = setInterval(() => {
      loadOrders();
    }, 60000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>Bestellungen</h1>
      </div>
      
      <div className={styles.orderList}>
        {loading && orders.length === 0 && (
          <div className={styles.loading}>Bestellungen werden geladen...</div>
        )}
        
        {error && (
          <div className={styles.error}>
            {error}
            <button onClick={handleRefresh} style={{ marginTop: '10px', padding: '5px 10px' }}>
              Erneut versuchen
            </button>
          </div>
        )}
        
        {orders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
        
        {!loading && orders.length === 0 && !error && (
          <div className={styles.empty}>Keine Bestellungen gefunden</div>
        )}
      </div>
      
      {/* Floating refresh button */}
      <button className={styles.refreshButton} onClick={handleRefresh} title="Aktualisieren">
        ↻
      </button>
    </main>
  );
}