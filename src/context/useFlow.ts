import { useContext } from 'react';
import { FlowContext, type FlowContextType } from './FlowContextDefinition';

export const useFlow = (): FlowContextType => {
  const ctx = useContext(FlowContext);
  if (!ctx) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return ctx;
};
