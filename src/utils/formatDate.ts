// src/utils/formatDate.ts

/**
 * Formats a date string into DD.MM.YYYY format
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) {
    return 'Kein Datum';
  }
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Ungültiges Datum';
    }
    
    // Format: DD.MM.YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Fehler beim Datum';
  }
}

/**
 * Checks if a deadline is less than 2 days away
 */
export function isDeadlineSoon(dateString: string | null): boolean {
  if (!dateString) {
    return false;
  }
  
  try {
    const deadline = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(deadline.getTime())) {
      return false;
    }
    
    const today = new Date();
    
    // Calculate the difference in days
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Return true if deadline is less than 2 days away
    return diffDays < 2;
  } catch (error) {
    console.error('Error checking deadline:', error);
    return false;
  }
}