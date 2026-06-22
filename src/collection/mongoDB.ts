import type { Collection } from '@collection/collection';
import { CollectionServer } from '@collection/server';
import type {
  GetCollectionByDomain,
  GetParam,
  GetParamIntersection,
  GetParamUnion,
} from '@collection/types';
import { MongoClient, type Filter } from 'mongodb';

export interface MongoDBAdapterOptions<TCollection extends Collection> {
  // collection: TCollection;
  getListFilter: (query: GetParam<TCollection, 'query'>) => Filter<GetParam<TCollection, 'item'>>;
}

export class MongoDBAdapter<TCollection extends Collection> {
  constructor(public readonly options: MongoDBAdapterOptions<TCollection>) {}
}

export interface MongoDBCollectionServerOptions<TCollections extends Collection[]> {
  client: MongoClient;
  adapters: { [K in keyof TCollections]: MongoDBAdapter<TCollections[K]> };
}

export class MongoDBCollectionServer<
  const TCollections extends Collection[],
> extends CollectionServer<TCollections> {
  constructor(public readonly options: MongoDBCollectionServerOptions<TCollections>) {
    super();
  }

  async list<TDomain extends GetParamUnion<TCollections, 'domain'>>(
    domain: TDomain,
    query: GetParam<GetCollectionByDomain<TCollections, TDomain>, 'query'>,
  ): Promise<GetParam<GetCollectionByDomain<TCollections, TDomain>, 'item'>[]> {
    const adapter = Object.values(this.options.adapters).find(
      (adapter) => adapter.options.collection.domain === domain,
    );

    if (!adapter) {
      throw new Error(`No adapter found for domain ${domain}`);
    }

    const collectionName = adapter.options.collection.collectionName ?? domain;
    const [dbName, collName] = collectionName.split('.');
    if (!dbName || !collName) {
      throw new Error(`Invalid collection name ${collectionName}`);
    }

    const coll = this.options.client
      .db(dbName)
      .collection<GetParam<GetParamIntersection<TCollections, 'domain'>, 'item'>>(collName);
    const filter = adapter.options.getListFilter(query);
    return await coll.find(filter).toArray();
  }
}
