import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import React, { Suspense } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchStore } from '../../src';
import { read } from '../../src/react';

const originalError = console.error;

afterEach(() => {
  console.error = originalError;
});

function Container({ children }: { children: ReactNode }) {
  return (
    <div data-testid="content">
      <ErrorBoundary>
        <Suspense fallback={<div>fallback</div>}>{children}</Suspense>
      </ErrorBoundary>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: ReactNode }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() {
    // ignore
  }

  render() {
    if (this.state.error) {
      return <div>error: {this.state.error.message}</div>;
    }

    return this.props.children;
  }
}

describe('read', () => {
  test('read returns plain value when value is resolved', async () => {
    const s = fetchStore(async () => ({ x: 0 }));
    await s.get();

    const Component = vi.fn<[], any>(function Component() {
      const { x } = read(s);

      return <div>{x}</div>;
    });

    render(
      <Container>
        <Component />
      </Container>,
    );
    const div = screen.getByTestId('content');
    expect(div.textContent).toBe('0');
  });

  test('read throws promise while value is pending', async () => {
    const s = fetchStore(
      async () =>
        new Promise<{ x: number }>(() => {
          // never resolve
        }),
    );

    const Component = vi.fn<[], any>(function Component() {
      const { x } = read(s);

      return <div>{x}</div>;
    });

    render(
      <Container>
        <Component />
      </Container>,
    );
    const div = screen.getByTestId('content');
    expect(div.textContent).toBe('fallback');
  });

  test('read throws error when value is rejected', async () => {
    console.error = () => undefined;

    const s = fetchStore(async () => {
      throw new Error('error');
    });
    await s.get().catch(() => undefined);

    const Component = vi.fn<[], any>(function Component() {
      const { x } = read(s);

      return <div>{x}</div>;
    });

    render(
      <Container>
        <Component />
      </Container>,
    );
    const div = screen.getByTestId('content');
    expect(div.textContent).toBe('error: error');
  });
});
