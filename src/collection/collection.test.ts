import { createClientCollection } from '@collection/client';
import { createCollection } from '@collection/collection';
import { DirectConnection } from '@collection/directConnection';
import { InMemoryServerCollection } from '@collection/inMemoryDB';
import { ServerCollectionHub } from '@collection/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

afterEach(() => {
  vi.useRealTimers();
});

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

const exampleEmails = [
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
] as const;

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

const exampleUsers = [
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
] as const;

function prepare() {
  const connection = new DirectConnection(exampleUsers[0]);
  const otherConnection = new DirectConnection(exampleUsers[1]);

  const emailClient = createClientCollection({
    connection: connection.client,
    collection: emailCollection,
  });

  const otherEmailClient = createClientCollection({
    connection: otherConnection.client,
    collection: emailCollection,
  });

  const userClient = createClientCollection({
    connection: connection.client,
    collection: userCollection,
  });

  const emailServer = new InMemoryServerCollection({
    collection: emailCollection,
    initialData: exampleEmails,
  });

  const userServer = new InMemoryServerCollection({
    collection: userCollection,
    initialData: exampleUsers,
  });

  const hub = new ServerCollectionHub({
    collections: [emailServer, userServer],
  });

  hub.connect(connection.server);
  hub.connect(otherConnection.server);

  return {
    connection,
    otherConnection,
    emailClient,
    otherEmailClient,
    userClient,
    emailServer,
    userServer,
    hub,
  };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve));
}

test('collection server', async () => {
  const { emailClient } = prepare();
  const emails = await emailClient.get({});
  expect(emails).toEqual(exampleEmails);
});

describe('fetching queries', () => {
  test('only the queried part is sent from the server', async () => {
    const { connection, emailClient } = prepare();
    const serverSend = vi.spyOn(connection.server, 'send');
    const emails = await emailClient.get({ userId: '1' });

    expect(emails).toHaveLength(2);
    expect(emailClient.items).toHaveLength(2);
    expect(serverSend).toHaveBeenCalledExactlyOnceWith(
      'email',
      exampleEmails
        .filter((x) => x.userId === '1')
        .map((item) => ['update', item])
        .concat([['init', expect.any(String)]]),
    );
  });

  test('when a second query is fetched, only the new items are sent from the server', async () => {
    const { connection, emailClient } = prepare();
    const serverSend = vi.spyOn(connection.server, 'send');

    using _ = emailClient.getSet({ userId: '1' }).subscribe(() => void 0);
    await emailClient.get({ userId: '1' });
    serverSend.mockClear();

    await emailClient.get({});

    expect(emailClient.items).toHaveLength(3);
    expect(serverSend).toHaveBeenCalledExactlyOnceWith('email', [
      ['update', exampleEmails[1]],
      ['init', expect.any(String)],
    ]);
  });

  test('when a second query is fetched that is a subset of the first query, no items are sent from the server', async () => {
    const { connection, emailClient } = prepare();
    const serverSend = vi.spyOn(connection.server, 'send');

    using _ = emailClient.getSet({ userId: '1' }).subscribe(() => void 0);
    await emailClient.get({ userId: '1' });
    serverSend.mockClear();

    await emailClient.get({ id: '1' });

    expect(emailClient.items).toHaveLength(2);
    expect(serverSend).toHaveBeenCalledExactlyOnceWith('email', [['init', expect.any(String)]]);
  });

  test('edge case: first query is disabled while the second query is being fetched, the second query is still sent from the server', async () => {
    const { connection, emailClient, emailServer } = prepare();
    const serverSend = vi.spyOn(connection.server, 'send');
    const originalSeverList = emailServer.list.bind(emailServer);
    vi.spyOn(emailServer, 'list').mockImplementation(async function* (include, exclude, t) {
      const items = originalSeverList(include, exclude, t);
      yield items[0]!;
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield* items.slice(1);
    });

    const q1 = emailClient.getSet({}).subscribe(() => void 0);
    using _q2 = emailClient.getSet({ id: '1' }).subscribe(() => void 0);
    q1();

    const result = await emailClient.get({ id: '1' });

    expect(result).toHaveLength(1);

    expect(serverSend).nthCalledWith(1, 'email', [
      ['update', exampleEmails[0]],
      ['init', expect.any(String)],
    ]);
    expect(serverSend).toHaveBeenLastCalledWith('email', [
      ['update', exampleEmails[0]],
      ['init', expect.any(String)],
    ]);
  });
});

describe('updates are forwarded', () => {
  test('updated item is sent to active client if it matches the query', async () => {
    const { emailClient, otherEmailClient } = prepare();

    using _ = emailClient.getSet({ id: '1' }).subscribe(() => void 0);
    await emailClient.get({ id: '1' });
    expect(emailClient.items).toHaveLength(1);

    const updatedEmail = {
      ...exampleEmails[0],
      subject: 'Updated Subject',
    };

    otherEmailClient.update(updatedEmail);
    await tick();
    await tick();

    expect(Array.from(emailClient.items.values())).toEqual([
      {
        ...updatedEmail,
        modifiedOn: expect.any(Date),
      },
    ]);
  });

  test('updated item is not sent to inactive client', async () => {
    const { emailClient, otherEmailClient } = prepare();

    await emailClient.get({ id: '1' });
    expect(emailClient.items).toHaveLength(1);

    const updatedEmail = {
      ...exampleEmails[0],
      subject: 'Updated Subject',
    };

    vi.useFakeTimers();
    otherEmailClient.update(updatedEmail);
    await vi.advanceTimersByTimeAsync(0);
    expect(Array.from(emailClient.items.values())).toEqual([exampleEmails[0]]);
  });

  test('updated item is not sent to client if it does not match the query', async () => {
    const { emailClient, otherEmailClient } = prepare();

    using _ = emailClient.getSet({ id: '1' }).subscribe(() => void 0);
    await emailClient.get({ id: '1' });
    expect(emailClient.items).toHaveLength(1);

    const updatedEmail = {
      ...exampleEmails[1],
      subject: 'Updated Subject',
    };

    vi.useFakeTimers();
    otherEmailClient.update(updatedEmail);
    await vi.advanceTimersByTimeAsync(0);
    expect(emailClient.items).toHaveLength(1);
  });

  test('updated item is sent to client only once if it matches multiple queries', async () => {
    const { emailClient, otherEmailClient, connection } = prepare();
    const clientReceive = vi.spyOn(connection.client, 'receive');

    using _1 = emailClient.getSet({ id: '1' }).subscribe(() => void 0);
    using _2 = emailClient.getSet({ userId: '1' }).subscribe(() => void 0);
    await emailClient.get({ id: '1' });
    await emailClient.get({ userId: '1' });

    expect(emailClient.items).toHaveLength(2);
    clientReceive.mockClear();

    const updatedEmail = {
      ...exampleEmails[0],
      subject: 'Updated Subject',
    };

    otherEmailClient.update(updatedEmail);
    await tick();
    await tick();

    expect(Array.from(emailClient.items.values())).toEqual([
      {
        ...updatedEmail,
        modifiedOn: expect.any(Date),
      },
      exampleEmails[2],
    ]);

    expect(clientReceive).toHaveBeenCalledExactlyOnceWith('email', [
      ['update', expect.objectContaining({ subject: 'Updated Subject' })],
    ]);
  });
});

describe('reconnection', () => {
  test('client receives changed items after reconnection', async () => {
    const { emailClient, otherEmailClient } = prepare();
    const clientReceive = vi.spyOn(emailClient.options.connection, 'receive');

    const firstState = await emailClient.get({});
    expect(emailClient.items).toHaveLength(3);
    clientReceive.mockClear();

    otherEmailClient.update({
      ...exampleEmails[0],
      subject: 'Updated Subject',
    });

    await tick();

    expect(Array.from(emailClient.items.values())).toEqual(firstState);
    expect(clientReceive).not.toHaveBeenCalled();

    await emailClient.get({});
    expect(Array.from(emailClient.items.values())).toEqual([
      {
        ...exampleEmails[0],
        subject: 'Updated Subject',
        modifiedOn: expect.any(Date),
      },
      ...exampleEmails.slice(1),
    ]);

    expect(clientReceive).toHaveBeenCalledExactlyOnceWith('email', [
      // since it's a >= relatino with the last known timestamp, one item is sent again
      ['update', expect.objectContaining({ id: '3' })],
      ['update', expect.objectContaining({ id: '1', subject: 'Updated Subject' })],
      ['init', expect.anything()],
    ]);
  });
});

// test('optimistic update', async () => {
//   const { emailClient, emailServer } = prepare();
//   await emailClient.get({});

//   const updatedEmail = {
//     ...exampleEmails[0],
//     subject: 'Updated Subject',
//   };

//   emailClient.update(updatedEmail);
//   expect((await emailClient.get({}))[0]).toEqual(updatedEmail);
//   expect(emailServer.list({}, null)).toEqual(exampleEmails);
// });
