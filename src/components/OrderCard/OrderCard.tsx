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

  // Состояния для отслеживания загрузки изображения
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const deadlineSoon = isDeadlineSoon(deadline);
  const isCompleted = status === 'Abholbereit';
  
  // Производственные этапы
  const productionStages = ['CNC', 'LED', 'Silikon', 'UV Print', 'Lack', 'Verpackung'];

  // Проверяем, является ли URL изображения защищенным от Monday.com
  const isMondayProtectedUrl = mockupUrl && (
    mockupUrl.includes('/protected_static/') || 
    mockupUrl.includes('monday.com') ||
    mockupUrl.includes('files.monday.com')
  );
  
  // Извлекаем ID ресурса из URL Monday для лучшей обработки ошибок
  let assetId = '';
  if (isMondayProtectedUrl) {
    if (mockupUrl.includes('/resources/')) {
      const match = mockupUrl.match(/\/resources\/(\d+)\//);
      if (match && match[1]) {
        assetId = match[1];
      }
    } else if (mockupUrl.includes('/file/d/')) {
      const match = mockupUrl.match(/\/file\/d\/(\d+)\//);
      if (match && match[1]) {
        assetId = match[1];
      }
    } else if (mockupUrl.includes('/files/')) {
      const match = mockupUrl.match(/\/files\/(\d+)\//);
      if (match && match[1]) {
        assetId = match[1];
      }
    }
  }
  
  // Формируем правильный URL для изображения
  const imageDisplayUrl = isMondayProtectedUrl 
    ? `/api/monday-image?url=${encodeURIComponent(mockupUrl)}&id=${assetId}&t=${Date.now()}` 
    : mockupUrl;

  // Обработка ошибки загрузки изображения
  const handleImageError = () => {
    console.log(`Ошибка загрузки изображения для заказа ${order.id}: ${imageDisplayUrl}`);
    setImageError(true);
    setImageLoading(false);
  };

  // Обработка успешной загрузки изображения
  const handleImageLoad = () => {
    console.log(`Успешно загружено изображение для заказа ${order.id}`);
    setImageLoading(false);
  };

  // Функция для повторной попытки загрузки изображения
  const retryImageLoad = () => {
    setImageError(false);
    setImageLoading(true);
    // Принудительное обновление URL с новым временным штампом
    const timestamp = Date.now();
    const newUrl = `/api/monday-image?url=${encodeURIComponent(mockupUrl)}&id=${assetId}&t=${timestamp}`;
    
    // Напрямую обновить src изображения, если возможно
    const imgElement = document.querySelector(`[alt="${name || 'Neon sign'}"]`) as HTMLImageElement;
    if (imgElement) {
      imgElement.src = newUrl;
    }
  };

  return (
    <div className={styles.card}>
      {/* Изображение макета */}
      <div className={styles.mockupContainer}>
        {mockupUrl ? (
          <>
            {imageLoading && !imageError && (
              <div className={styles.imageLoading}>
                <div className={styles.spinner}></div>
                <div>Lade Bild...</div>
              </div>
            )}
            
            <Image 
              src={imageDisplayUrl} 
              alt={name || 'Neon sign'} 
              width={300} 
              height={200} 
              className={`${styles.mockup} ${imageLoading || imageError ? styles.hiddenImage : ''}`}
              unoptimized={true}
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
                  onClick={retryImageLoad}
                >
                  Erneut versuchen
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.noMockup}>
            <div>{name || 'Kein Bild verfügbar'}</div>
          </div>
        )}
      </div>

      {/* Правая секция с информацией о заказе */}
      <div className={styles.infoContainer}>
        {/* Название заказа */}
        <div className={styles.orderName}>{name}</div>

        {/* Срок выполнения */}
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

        {/* Этапы производства */}
        <div className={styles.productionStages}>
          {productionStages.map((stage) => (
            <ProductionStage 
              key={stage} 
              stage={stage as any}
              isCompleted={completedStages.includes(stage)}
            />
          ))}
        </div>

        {/* Текущий статус */}
        <div className={styles.status}>
          <div className={styles.statusLabel}>Status:</div>
          <div className={styles.statusValue}>{status || 'Nicht begonnen'}</div>
        </div>

        {/* Нижняя секция */}
        <div className={styles.bottomSection}>
          {/* Дополнения (Левая часть) */}
          <div className={styles.bottomLeft}>
            <AddOns 
              wasserdicht={wasserdicht}
              fernbedienung={true} // Всегда true согласно требованиям
              versandart={versandart}
            />
          </div>

          {/* Расчет мощности (Правая часть) */}
          <div className={styles.bottomRight}>
            <PowerCalculation ledLength={ledLength} />
          </div>
        </div>

        {/* Галочка завершения */}
        {isCompleted && (
          <div className={styles.completionCheckmark}>
            <Image 
              src="/icons/prufen.png" 
              alt="Abholbereit" 
              width={64} 
              height={64}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;