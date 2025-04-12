// src/components/PowerCalculation/PowerCalculation.tsx
import React from 'react';
import Image from 'next/image';
import { PowerCalculationProps } from '@/lib/types';
import { calculatePower } from '@/utils/calculatePower';
import styles from './PowerCalculation.module.css';

const PowerCalculation: React.FC<PowerCalculationProps> = ({ ledLength }) => {
  // Calculate power based on the formula: led_länge * 9 * 1.25
  const wattage = calculatePower(ledLength);
  
  return (
    <div className={styles.powerCalculation}>
      <div className={styles.icon}>
        <Image 
          src="/icons/013-energetic.png" 
          alt="Watt" 
          width={40} 
          height={40}
        />
      </div>
      <div className={styles.wattage}>
        {wattage}W
      </div>
    </div>
  );
};

export default PowerCalculation;