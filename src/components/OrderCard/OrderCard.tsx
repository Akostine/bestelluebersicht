// src/components/OrderCard/OrderCard.tsx
import React, { useState } from 'react';
import Image from 'next/image';
import { OrderCardProps } from '@/lib/types';
import ProductionStage from '../ProductionStage/ProductionStage';
import AddOns from '../AddOns/AddOns';
import PowerCalculation from '../PowerCalculation/PowerCalculation';
import { formatDate, isDeadlineSoon } from '@/utils/formatDate';
import styles from './OrderCard.module.css';

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const { 
    name, 
    mockupUrl, 
    deadline, 
    status, 
    ledLength, 
    wasserdicht, 
    versandart, 
    completedStages 
  } = order;

  // States для отслеживания загрузки изображения
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const deadlineSoon = isDeadlineSoon(deadline);
  const isCompleted = status === 'Abholbereit';
  
  // Define production stages
  const productionStages = ['CNC', 'LED', 'Silikon', 'UV Print', 'Lack', 'Verpackung'];

  // Check if mockupUrl is from Monday.com's protected storage
  const isMondayProtectedUrl = mockupUrl && mockupUrl.includes('/protected_static/');
  
  // Extracting asset ID from Monday URL for better error reporting
  let assetId = '';
  if (isMondayProtectedUrl && mockupUrl.includes('/resources/')) {
    const match = mockupUrl.match(/\/resources\/(\d+)\//);
    if (match && match[1]) {
      assetId = match[1];
    }
  }
  
  // Get the correct image URL - either direct or through our proxy
  const imageDisplayUrl = isMondayProtectedUrl 
    ? `/api/monday-image?url=${encodeURIComponent(mockupUrl)}&id=${assetId}` 
    : mockupUrl;

  // Handle image loading error
  const handleImageError = () => {
    console.log(`Error loading image for order ${order.id}: ${imageDisplayUrl}`);
    setImageError(true);
    setImageLoading(false);
  };

  // Handle image loading complete
  const handleImageLoad = () => {
    console.log(`Successfully loaded image for order ${order.id}`);
    setImageLoading(false);
  };

  return (
    <div className={styles.card}>
      {/* Mockup Image */}
      <div className={styles.mockupContainer}>
        {mockupUrl ? (
          <>
            {/* {imageLoading && !imageError && (
              <div className={styles.imageLoading}>
                <div className={styles.spinner}></div>
                <div>Lade Bild...</div>
              </div>
            )} */}
            
            <Image 
              src={imageDisplayUrl} 
              alt={name || 'Neon sign'} 
              width={300} 
              height={200} 
              className={`${styles.mockup} ${imageLoading || imageError ? styles.hiddenImage : ''}`}
              unoptimized 
              onError={handleImageError}
              onLoad={handleImageLoad}
              style={{ opacity: imageLoading || imageError ? 0 : 1 }}
            />
            
            {imageError && (
              <div className={styles.imageError}>
                <div className={styles.errorIcon}>!</div>
                <div>{name || 'Bild nicht verfügbar'}</div>
                <button 
                  className={styles.retryButton}
                  onClick={() => {
                    setImageError(false);
                    setImageLoading(true);
                    // Force reload by adding timestamp
                    const imgElement = document.querySelector(`[alt="${name || 'Neon sign'}"]`) as HTMLImageElement;
                    if (imgElement) {
                      const newUrl = `${imageDisplayUrl}${imageDisplayUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
                      imgElement.src = newUrl;
                    }
                  }}
                >
                  Erneut versuchen
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.noMockup}>Kein Bild verfügbar</div>
        )}
      </div>

      {/* Right section with order info */}
      <div className={styles.infoContainer}>
        {/* Item name */}
        <div className={styles.orderName}>{name}</div>

        {/* Deadline section */}
        <div className={`${styles.deadline} ${deadlineSoon ? styles.deadlineSoon : ''}`}>
          {formatDate(deadline)}
          {deadlineSoon && (
            <div className={styles.warningIcon}>
              <Image 
                src="/icons/001-warning.png" 
                alt="Deadline bald" 
                width={32} 
                height={32}
              />
            </div>
          )}
        </div>

        {/* Production stages */}
        <div className={styles.productionStages}>
          {productionStages.map((stage) => (
            <ProductionStage 
              key={stage} 
              stage={stage as any}
              isCompleted={completedStages.includes(stage)}
            />
          ))}
        </div>

        {/* Bottom section */}
        <div className={styles.bottomSection}>
          {/* Add-ons (Left) */}
          <div className={styles.bottomLeft}>
            <AddOns 
              wasserdicht={wasserdicht}
              fernbedienung={true} // Always true as per requirements
              versandart={versandart}
            />
          </div>

          {/* Power calculation (Right) */}
          <div className={styles.bottomRight}>
            <PowerCalculation ledLength={ledLength} />
          </div>
        </div>

        {/* Completion checkmark */}
        {isCompleted && (
          <div className={styles.completionCheckmark}>
            <Image 
              src="/icons/prufen.png" 
              alt="Abholbereit" 
              width={48} 
              height={48}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;