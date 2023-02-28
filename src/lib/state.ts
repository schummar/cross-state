export type ValueState<T> = {
  status: 'value';
  value: T;
  error?: undefined;
};

export type ErrorState = {
  status: 'error';
  value?: undefined;
  error: unknown;
};

export type PendingState = {
  status: 'pending';
  value?: undefined;
  error?: undefined;
};

export type State<T> = ValueState<T> | ErrorState | PendingState;
