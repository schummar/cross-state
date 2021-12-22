/**
 * @jest-environment jsdom
 */

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { Component, Suspense } from 'react';
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

const throwing = createResource(async () => {
  throw Error();
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

function Throwing() {
  const value = useReadResource(throwing());
  return <>{value}</>;
}

test('suspense', async () => {
  render(
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

test('suspense error', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  let error;

  class ErrorBoundary extends Component {
    state = { error: undefined as unknown };

    componentDidCatch(e: unknown) {
      error = e;
      this.setState({ error: e });
    }

    render() {
      if (this.state.error) return <>Error!</>;
      return this.props.children;
    }
  }

  render(
    <Suspense fallback="suspense">
      <ErrorBoundary>
        <Throwing />
      </ErrorBoundary>
    </Suspense>
  );

  await act(() => Promise.resolve());
  expect(error).toBeTruthy();
});
