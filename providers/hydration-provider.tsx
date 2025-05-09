"use client";

import React, { useState, useEffect, ReactNode } from 'react';

interface HydrationProviderProps {
  children: ReactNode;
}

/**
 * HydrationProvider prevents hydration mismatch errors by only rendering children
 * after the component has mounted on the client side.
 * 
 * This is useful for components that use browser-specific APIs like window or localStorage
 * that are not available during server-side rendering.
 */
export function HydrationProvider({ children }: HydrationProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  // This effect runs once after the component is mounted on the client
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Return null on the server, or if the component hasn't hydrated yet
  if (!isHydrated) {
    return null;
  }

  // Once hydrated, render the children
  return <>{children}</>;
}

/**
 * withHydration is a higher-order component (HOC) that wraps a component with the HydrationProvider
 * to prevent hydration mismatches for components that use browser-specific APIs.
 */
export function withHydration<P extends object>(Component: React.ComponentType<P>) {
  const WithHydration = (props: P) => {
    return (
      <HydrationProvider>
        <Component {...props} />
      </HydrationProvider>
    );
  };

  // Set display name for debugging
  const displayName = Component.displayName || Component.name || 'Component';
  WithHydration.displayName = `withHydration(${displayName})`;

  return WithHydration;
}

/**
 * useIsClient is a hook that returns a boolean indicating whether the code is running on the client
 * This is useful for conditionally rendering components that use browser-specific APIs
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient;
}
