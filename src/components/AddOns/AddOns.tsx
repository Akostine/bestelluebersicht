// src/components/AddOns/AddOns.tsx
import React from 'react';
import Image from 'next/image';
import { AddOnsProps } from '@/lib/types';
import styles from './AddOns.module.css';

// Mapping of versandart values to their respective icon files
const versandartIcons: Record<string, string> = {
  'delivery': '/icons/006-delivery.png',
  'lieferung': '/icons/004-hands.png',
  'montage': '/icons/005-maintenance.png',
  'selbstabholer': '/icons/abholer.png',
  'selbstabholung': '/icons/006-delivery.png',
  'abholer': '/icons/006-delivery.png',
  'versand': '/icons/008-delivery-1.png'
};

const AddOns: React.FC<AddOnsProps> = ({ wasserdicht, fernbedienung, versandart }) => {
  // Normalize versandart to lowercase for case-insensitive matching
  const normalizedVersandart = versandart?.toLowerCase() || '';
  
  // Find the appropriate icon for the versandart
  const versandartIcon = Object.entries(versandartIcons).find(
    ([key]) => normalizedVersandart.includes(key)
  )?.[1] || '';

  return (
    <div className={styles.addOns}>
      {/* Remote control is always included */}
      <div className={styles.addOn}>
        <Image 
          src="/icons/015-remote-control.png" 
          alt="Fernbedienung" 
          width={64} 
          height={64}
        />
      </div>
      
      {/* Show water drop icon if wasserdicht is true */}
      {wasserdicht && (
        <div className={styles.addOn}>
          <Image 
            src="/icons/002-water-drop.png" 
            alt="Wasserdicht" 
            width={64} 
            height={64}
          />
        </div>
      )}
      
      {/* Show shipping method icon if available */}
      {versandartIcon && (
        <div className={styles.addOn}>
          <Image 
            src={versandartIcon} 
            alt={versandart} 
            width={64} 
            height={64}
          />
        </div>
      )}
    </div>
  );
};

export default AddOns;