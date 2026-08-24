"use client";

import React, { createContext, useContext, useState } from 'react';

interface AnalysisContextType {
  activeAnalysis: any;
  setActiveAnalysis: (analysis: any) => void;
}

const AnalysisContext = createContext<AnalysisContextType>({
  activeAnalysis: null,
  setActiveAnalysis: () => {},
});

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAnalysis, setActiveAnalysis] = useState<any>(null);

  return (
    <AnalysisContext.Provider value={{ activeAnalysis, setActiveAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useActiveAnalysis = () => useContext(AnalysisContext);
