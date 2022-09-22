export type UnwrapPromise<T> = T extends Promise<infer S> ? UnwrapPromise<S> : T;
