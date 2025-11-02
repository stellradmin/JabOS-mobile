import React, { createContext, useContext, useMemo, useState } from 'react';

type Direction = 'left' | 'right' | 'none';

interface TabTransitionContextValue {
  direction: Direction;
  setDirection: (dir: Direction) => void;
}

const TabTransitionContext = createContext<TabTransitionContextValue | undefined>(undefined);

export const TabTransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [direction, setDirection] = useState<Direction>('none');

  const value = useMemo(() => ({ direction, setDirection }), [direction]);

  return (
    <TabTransitionContext.Provider value={value}>
      {children}
    </TabTransitionContext.Provider>
  );
};

export const useTabTransition = () => {
  const ctx = useContext(TabTransitionContext);
  if (!ctx) throw new Error('useTabTransition must be used within TabTransitionProvider');
  return ctx;
};

