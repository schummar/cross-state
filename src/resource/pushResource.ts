import { ResourceInfo } from '..';
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
    super(options);
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

  get(): Promise<Value> {
    return new Promise((resolve, reject) => {
      const cancel = this.subscribe(() => {
        const cache = this.getCache();
        if (cache.state === 'value') resolve(cache.value);
        else if (cache.state === 'error') reject(cache.error);
        else return;
        setTimeout(() => cancel());
      });
    });
  }

  subscribe(
    listener: (state: ResourceInfo<Value>) => void,
    { watchOnly, ...storeSubscribeoOptions }: ResourceSubscribeOptions = {}
  ): Cancel {
    if (!watchOnly) {
      this.activeSubscribers++;
    }
    if (this.activeSubscribers === 1) {
      this.connect();
    }

    const cancelStoreSubscription = this.cache.subscribe(() => this.getCache(), listener, storeSubscribeoOptions);

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
    let buffer = new Array<Value | ((state: ResourceInfo<Value>) => Value)>();
    let canceled = false;

    const process = (update: Value | ((state: ResourceInfo<Value>) => Value)) => {
      if (update instanceof Function) {
        try {
          update = update(this.getCache());
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
              getInitialTask = undefined;
              task = getInital(this.arg);
              getInitialTask = task;
              const value = await task;

              if (getInitialTask === task) {
                this.cache.batchUpdates(() => {
                  this.setValue(value);
                  buffer.forEach(process);
                });
                buffer = [];
                getInitialTask = undefined;
              }
            } catch (e) {
              if (getInitialTask === task) {
                this.cache.batchUpdates(() => {
                  this.setError(e);
                  buffer.forEach(process);
                });
                buffer = [];
                getInitialTask = undefined;
              }
            }
          }
        },

        onDisconnected: () => {
          if (canceled) return;

          this.cache.batchUpdates(() => {
            this.updateCache((state) => {
              state.connectionState = 'disconnected';
            });

            this.invalidateCache();
          });

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
}
