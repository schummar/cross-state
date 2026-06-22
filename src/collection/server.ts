import type { Collection } from '@collection/collection';
import type { ServerConnection } from '@collection/connection';
import type { DB } from '@collection/db';
import type { GetParam, GetParamIntersection, GetParamUnion } from '@collection/types';
import type { DisposableCancel } from '@core';
import disposable from '@lib/disposable';

export interface CollectionServerOptions<TCollections extends Collection[]> {
  collections: TCollections;
  db: DB<TCollections>;
}

export abstract class CollectionServer<TCollections extends Collection[]> {
  connections: Set<ServerConnection<any>> = new Set();

  //   constructor(public readonly options: CollectionServerOptions<TCollections>) {
  //     this.start();
  //   }

  protected start(): void {}

  connect(
    connection: ServerConnection<GetParamIntersection<TCollections, 'user'>>,
  ): DisposableCancel {
    this.connections.add(connection);

    return disposable(() => {
      this.connections.delete(connection);
    });
  }

  abstract list<TDomain extends GetParamUnion<TCollections, 'domain'>>(
    domain: TDomain,
    query: GetParam<GetParamIntersection<TCollections, 'domain'>, 'query'>,
  ): Promise<GetParam<GetParamIntersection<TCollections, 'domain'>, 'item'>[]>;
}
