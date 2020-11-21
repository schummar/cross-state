export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;
export type MaybePromise<T> = T | Promise<T>;
export type KeysOfPropType<T, PropType> = keyof { [K in keyof T as T[K] extends PropType ? K : never]: T[K] };
