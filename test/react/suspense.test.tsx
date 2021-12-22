/**
 * @jest-environment jsdom
 */

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { createPushResource, createResource } from '../../src';
import { combineResources, useReadResource } from '../../src/react';
import { sleep } from '../_helpers';

jest.useFakeTimers();

afterEach(() => {
  jest.runAllTimers();
});

const user = createResource(async (name: string) => {
  await sleep(name === 'a' ? 100 : 200);
  return { name };
});

const webSocket = createPushResource({
  async getInital() {
    await sleep(300);
    return 'ok';
  },
  connect({ onConnected }) {
    onConnected();
    return () => undefined;
  },
});

function User({ id }: { id: string }) {
  const { name } = useReadResource(user(id));
  return <>User:{name};</>;
}

function UserList() {
  const users = useReadResource(combineResources(user('a'), user('b')));
  return <>UserList:{users.map((user) => user.name).join(',')};</>;
}

function WebSocket() {
  const value = useReadResource(webSocket());
  return <>ws:{value};</>;
}

function App() {
  return (
    <div data-testid="div">
      <Suspense fallback="suspense1">
        <User id="a" />
        <User id="b" />
      </Suspense>
      _
      <Suspense fallback="suspense2">
        <UserList />
        <WebSocket />
      </Suspense>
    </div>
  );
}

test('suspense', async () => {
  render(<App />);
  const div = screen.getByTestId('div');

  act(() => jest.advanceTimersByTime(50));
  await act(() => Promise.resolve());
  expect(div.textContent).toBe('suspense1_suspense2');

  act(() => jest.advanceTimersByTime(200));
  await act(() => Promise.resolve());
  expect(div.textContent).toBe('User:a;User:b;_suspense2');

  act(() => jest.advanceTimersByTime(100));
  await act(() => Promise.resolve());
  expect(div.textContent).toBe('User:a;User:b;_UserList:a,b;ws:ok;');
});
