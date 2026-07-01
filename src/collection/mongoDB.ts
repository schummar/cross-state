import type { Collection } from '@collection/collection';
import { ServerCollection } from '@collection/server';
import type { GetParam } from '@collection/types';
import { type Filter, type MongoClient } from 'mongodb';

export interface MongoDBServerCollectionOptions<TCollection extends Collection> {
  collection: TCollection;
  client: MongoClient;
  db: string;
  coll: string;
  getListFilter(
    query: GetParam<TCollection, 'query'>,
    t: number | null,
  ): Filter<GetParam<TCollection, 'item'>>;
}

export class MongoDBServerCollection<
  const TCollection extends Collection,
> extends ServerCollection<TCollection> {
  constructor(public readonly options: MongoDBServerCollectionOptions<TCollection>) {
    super(options);
  }

  async list(
    query: GetParam<TCollection, 'query'>,
    t: number | null,
  ): Promise<GetParam<TCollection, 'item'>[]> {
    const filter = this.options.getListFilter(query, t);
    const collection = this.options.client
      .db(this.options.db)
      .collection<GetParam<TCollection, 'item'>>(this.options.coll);

    const items = await collection.find(filter).toArray();
    return items;
  }
}
