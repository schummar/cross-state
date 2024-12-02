import { castArray } from '@lib/castArray';
import { simpleHash } from '@lib/hash';
import { useEffect } from 'react';

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
    [simpleHash(key), type],
  );
}
