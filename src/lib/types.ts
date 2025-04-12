// src/lib/types.ts

export interface Order {
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

export type ProductionStage = 'CNC' | 'LED' | 'Silikon' | 'UV Print' | 'Lack' | 'Verpackung';

export interface ProductionStageProps {
  stage: ProductionStage;
  isCompleted: boolean;
}

export interface AddOnsProps {
  wasserdicht: boolean;
  fernbedienung: boolean; // This is always true per requirements
  versandart: string;
}

export interface PowerCalculationProps {
  ledLength: number;
}

export interface OrderCardProps {
  order: Order;
}