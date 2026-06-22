import { createCollectionClient } from '@collection/client';
import { createCollection, type Collection } from '@collection/collection';
import type { DB } from '@collection/db';
import { DirectConnection } from '@collection/directConnection';
import { InMemoryDB } from '@collection/inMemoryDB';
import { MongoDBAdapter, MongoDBCollectionServer } from '@collection/mongoDB';
import type { GetParam } from '@collection/types';
import { useCollection, useCollectionItem } from '@collection/useCollection';
import { MongoClient, type Filter } from 'mongodb';
import { z } from 'zod';

type Email = z.infer<typeof Email>;
const Email = z.object({
  id: z.string(),
  userId: z.string(),
  subject: z.string(),
  body: z.string(),
  modifiedOn: z.coerce.date(),
});

const EmailQuery = Email.partial().extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const emailCollection = createCollection({
  domain: 'email',
  schema: Email,
  query: EmailQuery,
  id: 'id',
  time: 'modifiedOn',
  matches(item, query) {
    const { from, to, ...match } = query;

    for (const [key, value] of Object.entries(match)) {
      if (value !== item[key as keyof typeof item]) {
        return false;
      }
    }

    if (from && item.modifiedOn < from) {
      return false;
    }

    if (to && item.modifiedOn > to) {
      return false;
    }

    return true;
  },
  auth(query, user: User) {
    return {
      ...query,
      userId: user.id,
    };
  },
});

type User = z.infer<typeof User>;
const User = z.object({
  id: z.string(),
  name: z.string(),
  modifiedOn: z.coerce.date(),
});

const UserQuery = User.partial();

const userCollection = createCollection({
  domain: 'user',
  schema: User,
  query: UserQuery,
  id: 'id',
  time: 'modifiedOn',
  matches(item, query) {
    if (query.name && item.name !== query.name) {
      return false;
    }

    return true;
  },
});

const connection = new DirectConnection({ id: '1', name: 'Alice' });

const emailClient = createCollectionClient({
  connection: connection.client,
  collection: emailCollection,
});

const userClient = createCollectionClient({
  connection: connection.client,
  collection: userCollection,
});

const db = new InMemoryDB<[typeof emailCollection, typeof userCollection]>({
  email: [
    {
      id: '1',
      userId: '1',
      subject: 'Hello 1',
      body: 'World 1',
      modifiedOn: new Date('2026-01-01'),
    },
    {
      id: '2',
      userId: '2',
      subject: 'Hello 2',
      body: 'World 2',
      modifiedOn: new Date('2026-01-02'),
    },
    {
      id: '3',
      userId: '1',
      subject: 'Hello 3',
      body: 'World 3',
      modifiedOn: new Date('2026-01-03'),
    },
  ],
  user: [
    {
      id: '1',
      name: 'Alice',
      modifiedOn: new Date('2026-01-01'),
    },
    {
      id: '2',
      name: 'Bob',
      modifiedOn: new Date('2026-01-02'),
    },
  ],
});

const server = new MongoDBCollectionServer({
  client: new MongoClient('mongodb://localhost:27017'),
  adapters: [
    new MongoDBAdapter({
      collection: emailCollection,
      getListFilter({ from, to, ...query }) {
        const filter: Filter<Email> = query;
        filter.$and = [];

        if (from) {
          filter.$and.push({ modifiedOn: { $gte: from } });
        }

        if (to) {
          filter.$and.push({ modifiedOn: { $lte: to } });
        }

        return filter;
      },
    }),
    new MongoDBAdapter({
      collection: userCollection,
      getListFilter(query) {
        return query;
      },
    }),
  ],
});

const emails = await server.list('email', {});
server.connect(connection.server);

function createCollectionServer<TCollection extends Collection>(options: {
  collection: TCollection;
  db: DB<TCollection>;
}) {}

function createMongDBAdapter<const TCollection extends Collection>(options: {
  getListFilter: (query: GetParam<TCollection, 'query'>) => Filter<GetParam<TCollection, 'item'>>;
}): DB<TCollection> {
  return {} as any;
}

const emailServer = createCollectionServer({
  collection: emailCollection,
  db: createMongDBAdapter<typeof userCollection>({
    getListFilter(query) {
      return query;
    },
  }),
});

function Component() {
  const _emails = useCollection(emailClient, {
    query: {
      subject: 'Hello',
    },
  });

  const [_latestEmail] = useCollection(emailClient, {
    query: {
      sort: {
        t: -1,
      },
      limit: 1,
    },
  });

  const _emailById = useCollectionItem(emailClient, '123');
}
