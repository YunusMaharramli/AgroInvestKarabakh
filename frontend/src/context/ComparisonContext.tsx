import React, { createContext, useContext, useState } from 'react';
import { AgriculturalLand } from '../types/index.js';

interface ComparisonContextType {
  compareLands: AgriculturalLand[];
  addToCompare: (land: AgriculturalLand) => boolean;
  removeFromCompare: (landId: string) => void;
  clearCompare: () => void;
  isInCompare: (landId: string) => boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [compareLands, setCompareLands] = useState<AgriculturalLand[]>([]);

  const isInCompare = (landId: string) => {
    return compareLands.some(l => l.id === landId);
  };

  const addToCompare = (land: AgriculturalLand): boolean => {
    if (isInCompare(land.id)) return true;
    if (compareLands.length >= 3) {
      return false; // Exceeded limit of 3
    }
    setCompareLands(prev => [...prev, land]);
    return true;
  };

  const removeFromCompare = (landId: string) => {
    setCompareLands(prev => prev.filter(l => l.id !== landId));
  };

  const clearCompare = () => {
    setCompareLands([]);
  };

  return (
    <ComparisonContext.Provider
      value={{
        compareLands,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => {
  const ctx = useContext(ComparisonContext);
  if (!ctx) throw new Error('useComparison must be used within ComparisonProvider');
  return ctx;
};
