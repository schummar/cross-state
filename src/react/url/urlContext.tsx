import React, { createContext, useContext, type Context, type ReactNode } from 'react';

export type Location = string | { pathname: string; search: string; hash: string };

export interface UrlContextType {
  location: Location;
  navigate: (navigate: (from: Location) => string) => void;
}

export type UrlContextProviderProps = { children?: ReactNode } & (
  | { location: UrlContextType['location'] }
  | { locationHook: () => UrlContextType['location'] }
) &
  ({ navigate: UrlContextType['navigate'] } | { navigateHook: () => UrlContextType['navigate'] });

export const UrlContext: Context<UrlContextType | undefined> = createContext<
  UrlContextType | undefined
>(undefined);

export function UrlProvider({ children, ...props }: UrlContextProviderProps): React.JSX.Element {
  const location = 'location' in props ? props.location : props.locationHook();
  const navigate = 'navigate' in props ? props.navigate : props.navigateHook();

  return <UrlContext.Provider value={{ location, navigate }}>{children}</UrlContext.Provider>;
}

export function useUrlContext(): UrlContextType {
  const context = useContext(UrlContext);
  if (!context) {
    throw new Error('useUrlContext must be used within a UrlContextProvider');
  }
  return context;
}
