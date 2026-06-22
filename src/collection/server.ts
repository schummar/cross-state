import type { AnyCollection } from '@collection/collection';
import type { ServerConnection } from '@collection/connection';
import type { DB } from '@collection/db';
import type { GetCombinedUser } from '@collection/types';
import type { DisposableCancel } from '@core';
import disposable from '@lib/disposable';

export interface CollectionServerOptions<TCollections extends AnyCollection[]> {
  collections: TCollections;
  db: DB<TCollections>;
}

export class CollectionServer<const TCollections extends AnyCollection[]> {
  connections: Set<ServerConnection<any>> = new Set();

  constructor(public readonly options: CollectionServerOptions<TCollections>) {
    this.start();
  }

  protected start(): void {}

  connect(connection: ServerConnection<GetCombinedUser<TCollections>>): DisposableCancel {
    this.connections.add(connection);

    return disposable(() => {
      this.connections.delete(connection);
    });
  }
}

export function createCollectionServer<const TCollections extends AnyCollection[]>(
  options: CollectionServerOptions<TCollections>,
): CollectionServer<TCollections> {
  return new CollectionServer<TCollections>(options);
}
