import type { Collection } from '@collection/collection';

export type DBEvent =
  | ['update', value: unknown, previousValue: unknown]
  | ['delete', value: unknown, previousValue: unknown]
  | ['clear'];

export abstract class DB<_TCollection extends Collection> {
  //   abstract list(domain: string, collectionName: string, query: TQuery): unknown[];
  //   abstract update(domain: string, collectionName: string, id: unknown, item: unknown): void;
  //   abstract delete(domain: string, collectionName: string, id: unknown): void;
  //   abstract subscribe(
  //     domain: string,
  //     collectionName: string,
  //     onEvent: (event: DBEvent) => void,
  //   ): () => void;
}
