import { useDecoupledState } from '@react/useDecoupledState';
import { render } from '@testing-library/react';
import { act } from 'react';
import { beforeAll, expect, test, vi } from 'vitest';

beforeAll(() => {
  vi.useFakeTimers();
});

test('useDecoupledState', () => {
  const onChange = vi.fn();

  function Component() {
    const [state, setState] = useDecoupledState<number>(0, onChange, { debounce: 500 });

    return (
      <button data-testid="button" onClick={() => setState(state + 1)}>
        {state}
      </button>
    );
  }

  const { getByTestId } = render(<Component />);
  const button = getByTestId('button');

  expect(button.textContent).toBe('0');

  act(() => button.click());
  expect(button.textContent).toBe('1');
  expect(onChange).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(250);
  });

  act(() => button.click());
  expect(button.textContent).toBe('2');
  expect(onChange).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(2);
});
