import React, { createContext, useContext, type Context, type ReactNode } from 'react';

export interface UrlContextType {
  href: string;
  navigate: (to: string) => void;
}

export type UrlContextProviderProps = { children?: ReactNode } & (
  | { href: string }
  | { hrefHook: () => string }
) &
  ({ navigate: (to: string) => void } | { navigateHook: () => (to: string) => void });

export const UrlContext: Context<UrlContextType | undefined> = createContext<
  UrlContextType | undefined
>(undefined);

export function UrlProvider({
  children,
  ...props
}: UrlContextProviderProps): React.JSX.Element {
  let href = 'href' in props ? props.href : props.hrefHook();
  const navigate = 'navigate' in props ? props.navigate : props.navigateHook();

  if (!href.startsWith(window.location.origin)) {
    href = new URL(href, window.location.origin).href;
  }

  return <UrlContext.Provider value={{ href, navigate }}>{children}</UrlContext.Provider>;
}

export function useUrlContext(): UrlContextType {
  const context = useContext(UrlContext);
  if (!context) {
    throw new Error('useUrlContext must be used within a UrlContextProvider');
  }
  return context;
}
