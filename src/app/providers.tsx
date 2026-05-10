import React from 'react';
import { GlobalStyle } from '@app/styles/global.styled';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Application-level providers wrapper.
 * Phase 2 will add: <Provider store={store}> (Redux)
 * Phase 3 will add: <BrowserRouter> (React Router)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <GlobalStyle />
      {children}
    </>
  );
}
