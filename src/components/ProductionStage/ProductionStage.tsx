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

const ProductionStage: React.FC<ProductionStageProps> = ({ stage, isCompleted }) => {
  // For debugging: log incoming props
  console.log(`ProductionStage rendering: stage=${stage}, isCompleted=${isCompleted}`);
  
  // Ensure we have an icon for this stage, use a fallback if not
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