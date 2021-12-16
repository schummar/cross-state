import { castDraft } from 'immer';
import { Cancel } from '../helpers/misc';
import { Resource, ResourceInstance, ResourceOptions, ResourceState, ResourceSubscribeOptions } from './resource';

export type PushResourceOptions<Arg, Value> = ResourceOptions<Value> & {
  getInital?: (arg: Arg) => Promise<Value>;
  connect: (
    callbacks: {
      onConnected: () => void;
      onDisconnected: () => void;
      onData: (data: Value | ((state: ResourceState<Value>) => Value)) => void;
      onError: (error: unknown) => void;
    },
    arg: Arg
  ) => Cancel;
};

export function createPushResource<Arg = undefined, Value = unknown>(
  options: PushResourceOptions<Arg, Value>
): PushResource<Arg, Value> & { (...args: Arg extends undefined ? [arg?: Arg] : [arg: Arg]): PushResourceInstance<Arg, Value> } {
  const resource = new PushResource(options);

  return new Proxy<any>(
    function (...[arg]: Arg extends undefined ? [arg?: Arg] : [arg: Arg]) {
      return resource.instance(arg as Arg);
    },
    {
      get(_target, prop) {
        return resource[prop as keyof Resource<Arg, Value>];
      },
    }
  );
}

export class PushResource<Arg, Value> extends Resource<Arg, Value> {
  constructor(public readonly options: PushResourceOptions<Arg, Value>) {
    super();
  }

  instance(arg: Arg): PushResourceInstance<Arg, Value> {
    return new PushResourceInstance(this, arg);
  }
}

export class PushResourceInstance<Arg, Value> extends ResourceInstance<Arg, Value> {
  constructor(public readonly resource: PushResource<Arg, Value>, public readonly arg: Arg) {
    super(resource, arg);
  }

  readonly options = this.resource.options;
  protected connection?: () => void;
  protected activeSubscribers = 0;

  subscribe(
    listener: (state: ResourceState<Value>) => void,
    { watchOnly, ...storeSubscribeoOptions }: ResourceSubscribeOptions = {}
  ): Cancel {
    if (!watchOnly) {
      this.activeSubscribers++;
    }
    if (this.activeSubscribers === 1) {
      this.connect();
    }

    const cancelStoreSubscription = this.cache.subscribe(() => this.getCache() ?? {}, listener, storeSubscribeoOptions);

    return () => {
      cancelStoreSubscription();
      if (!watchOnly) {
        this.activeSubscribers--;
      }
      if (this.activeSubscribers === 0) {
        this.disconnect();
      }
    };
  }

  protected connect() {
    const { getInital, connect } = this.options;

    let getInitialTask: Promise<Value> | undefined;
    let buffer = new Array<Value | ((state: ResourceState<Value>) => Value)>();
    let canceled = false;

    const process = (update: Value | ((state: ResourceState<Value>) => Value)) => {
      if (update instanceof Function) {
        try {
          update = update(this.getCache() ?? {});
        } catch (e) {
          this.setError(e);
          return;
        }
      }
      this.setValue(update);
    };

    this.updateCache((state) => {
      state.connectionState = 'disconnected';
    });

    const connection = connect(
      {
        onConnected: async () => {
          if (canceled) return;

          this.updateCache((state) => {
            state.connectionState = 'connected';
          });

          if (getInital) {
            let task;

            try {
              task = getInital(this.arg);
              getInitialTask = task;

              const value = await task;

              if (getInitialTask === task) {
                this.setValue(value);
                buffer.forEach(process);
                buffer = [];
                getInitialTask = undefined;
              }
            } catch (e) {
              if (getInitialTask === task) {
                this.setError(e);
                buffer.forEach(process);
                buffer = [];
                getInitialTask = undefined;
              }
            }
          }
        },

        onDisconnected: () => {
          if (canceled) return;

          this.updateCache((state) => {
            state.connectionState = 'disconnected';
          });

          this.invalidateCache();
          getInitialTask = undefined;
        },

        onData: (update) => {
          if (canceled) return;

          if (getInitialTask) {
            buffer.push(update);
          } else {
            process(update);
          }
        },

        onError: (error) => {
          if (canceled) return;
          this.setError(error);
        },
      },
      this.arg
    );

    this.connection = () => {
      connection();
      canceled = true;
      getInitialTask = undefined;
    };
  }

  protected disconnect() {
    this.connection?.();
    delete this.connection;
  }

  protected setValue(value: Value): void {
    this.updateCache((entry) => {
      entry.current = {
        kind: 'value',
        value: castDraft(value),
      };
      delete entry.future;
      delete entry.stale;
    });
    this.setTimers();
  }

  protected setError(error: unknown): void {
    this.updateCache((entry) => {
      entry.current = {
        kind: 'error',
        error,
      };
      delete entry.future;
      delete entry.stale;
    });
    this.setTimers();
  }

  protected setTimers(): void {
    let { invalidateAfter = Resource.options.invalidateAfter, clearAfter = Resource.options.clearAfter } = this.options;
    const state = this.getCache();
    const now = Date.now();

    this.updateCache((entry) => {
      if (invalidateAfter instanceof Function) {
        invalidateAfter = invalidateAfter(state ?? {});
      }
      if (invalidateAfter !== undefined && invalidateAfter !== Infinity) {
        entry.tInvalidate = now + invalidateAfter;
      }

      if (clearAfter instanceof Function) {
        clearAfter = clearAfter(state ?? {});
      }
      if (clearAfter !== undefined && clearAfter !== Infinity) {
        entry.tClear = now + clearAfter;
      }
    });
  }
}
