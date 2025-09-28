import React from 'react';
import { ImagesProvider } from './ImagesContext';
import { AnalysesProvider } from './AnalysesContext';
import { DetectionsProvider } from './DetectionsContext';

export const RealtimeProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ImagesProvider>
      <AnalysesProvider>
        <DetectionsProvider>
          {children}
        </DetectionsProvider>
      </AnalysesProvider>
    </ImagesProvider>
  );
};


