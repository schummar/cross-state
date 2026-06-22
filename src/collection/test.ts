import { createCollectionClient } from '@collection/client';
import { createCollection } from '@collection/collection';
import { DirectConnection } from '@collection/directConnection';
import { InMemoryDB } from '@collection/inMemoryDB';
import { createCollectionServer } from '@collection/server';
import { useCollection, useCollectionItem } from '@collection/useCollection';
import { z } from 'zod';

const Email = z.object({
  id: z.string(),
  userId: z.string(),
  subject: z.string(),
  body: z.string(),
  t: z.coerce.date(),
});

const EmailQuery = Email.partial().extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.partialRecord(Email.keyof(), z.union([z.literal(1), z.literal(-1)])).optional(),
  limit: z.number().optional(),
});

const emailCollection = createCollection({
  domain: 'email',
  schema: Email,
  query: EmailQuery,
  id: 'id',
  matches(item, query) {
    const { from, to, sort, limit, ...match } = query;

    for (const [key, value] of Object.entries(match)) {
      if (value !== item[key as keyof typeof item]) {
        return false;
      }
    }

    if (from && item.t < from) {
      return false;
    }

    if (to && item.t > to) {
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
});

const UserQuery = User.partial();

const userCollection = createCollection({
  domain: 'user',
  schema: User,
  query: UserQuery,
  id: 'id',
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
    { id: '1', userId: '1', subject: 'Hello 1', body: 'World 1', t: new Date('2026-01-01') },
    { id: '2', userId: '2', subject: 'Hello 2', body: 'World 2', t: new Date('2026-01-02') },
    { id: '3', userId: '1', subject: 'Hello 3', body: 'World 3', t: new Date('2026-01-03') },
  ],
  user: [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ],
});

db.update('email', () => ({}));
db.delete('email', 1);

const server = createCollectionServer({
  collections: [emailCollection, userCollection],
  db,
});

server.connect(connection.server);

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
