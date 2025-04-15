// src/components/ProductionStage/ProductionStage.tsx
import React from 'react';
import Image from 'next/image';
import { ProductionStageProps } from '@/lib/types';
import styles from './ProductionStage.module.css';

// Map of production stages to their respective icon files
const stageIcons: Record<string, string> = {
  'CNC': '/icons/frase.png',
  'LED': '/icons/led-leiste.png',
  'Silikon': '/icons/silikon.png',
  'UV Print': '/icons/011-print.png',
  'Lack': '/icons/009-paint.png',
  'Verpackung': '/icons/verpackung.png',
};

// Отладочный вывод для проверки имен этапов
console.log('Available stage keys in ProductionStage:', Object.keys(stageIcons));

const ProductionStage: React.FC<ProductionStageProps> = ({ stage, isCompleted }) => {
  // Отладочный вывод для проверки значений
  console.log(`Rendering stage: ${stage}, isCompleted: ${isCompleted}`);
  
  // Убедимся, что у нас есть иконка для этапа
  const iconSrc = stageIcons[stage] || '/icons/silikon.png';
  
  return (
    <div className={`${styles.stage} ${isCompleted ? styles.completed : ''}`}>
      <div className={styles.iconContainer}>
        <Image 
          src={iconSrc} 
          alt={stage} 
          width={64} 
          height={64} 
          className={styles.icon}
        />
        {isCompleted && (
          <div className={styles.checkmark}>
            <Image 
              src="/icons/prufen.png" 
              alt="Completed" 
              width={24} 
              height={24}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionStage;