import { type ReactNode, useEffect } from 'react';
import { castArray } from '@lib/castArray';
import { hash } from '@lib/hash';

export function useUrlParamScope({
  key,
  type = 'search',
}: {
  key: string | string[];
  type?: 'search' | 'hash';
}): void {
  useEffect(
    () => () => {
      const url = new URL(window.location.href);
      const parameters = new URLSearchParams(url[type].slice(1));

      for (const _key of castArray(key)) {
        parameters.delete(_key);
      }

      url[type] = parameters.toString();
      window.history.replaceState(null, '', url.toString());
    },
    [hash(key), type],
  );
}
