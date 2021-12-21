import { Cancel } from '../helpers/misc';
import { Resource, ResourceInstance, ResourceOptions, ResourceState, ResourceSubscribeOptions } from './resource';

export type PullResourceImplemenation<Arg, Value> = (arg: Arg) => Promise<Value>;

export function createResource<Arg = undefined, Value = unknown>(
  implementation: PullResourceImplemenation<Arg, Value>,
  options?: ResourceOptions<Value>
): PullResource<Arg, Value> & { (...args: Arg extends undefined ? [arg?: Arg] : [arg: Arg]): PullResourceInstance<Arg, Value> } {
  const resource = new PullResource(implementation, options);

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

export class PullResource<Arg, Value> extends Resource<Arg, Value> {
  constructor(
    //
    public readonly implementation: PullResourceImplemenation<Arg, Value>,
    public readonly options: ResourceOptions<Value> = {}
  ) {
    super(options);
  }

  instance(arg: Arg): PullResourceInstance<Arg, Value> {
    return new PullResourceInstance(this, arg);
  }
}

export class PullResourceInstance<Arg, Value> extends ResourceInstance<Arg, Value> {
  constructor(public readonly resource: PullResource<Arg, Value>, public readonly arg: Arg) {
    super(resource, arg);
  }

  readonly implementation = this.resource.implementation;
  readonly options = this.resource.options;

  update(update: Value | ((state: ResourceState<Value>) => Value), invalidate?: boolean | Promise<Value>): void {
    this.cache.batchUpdates(() => {
      if (update instanceof Function) {
        update = update(this.getCache());
      }

      this.setValue(update);

      if (invalidate) {
        this.invalidateCache();
      }
      if (invalidate instanceof Promise) {
        this.setFuture(invalidate);
      }
    });
  }

  async get({ returnStale = false, updateStale = true, forceUpdate = false } = {}): Promise<Value> {
    const { current, future, stale } = this.cache.getState().get(this.key) ?? {};

    const update = () => {
      const promise = this.implementation(this.arg);
      this.setFuture(promise);
      return promise;
    };

    if (current && (!stale || returnStale)) {
      if ((stale && updateStale && !future) || forceUpdate) {
        update();
      }

      if (current.kind === 'value') return current.value;
      throw current.error;
    } else if (future) {
      if (forceUpdate) {
        update();
      }

      return future;
    } else {
      return update();
    }
  }

  subscribe(
    listener: (state: ResourceState<Value>) => void,
    { watchOnly, ...storeSubscribeoOptions }: ResourceSubscribeOptions = {}
  ): Cancel {
    if (!watchOnly && !storeSubscribeoOptions.runNow) {
      this.get().catch(() => {
        // ignore
      });
    }
    return this.cache.subscribe(
      () => this.getCache(),
      (state) => {
        if (!watchOnly) {
          Promise.resolve()
            .then(() => this.get())
            .catch(() => {
              // ignore
            });
        }
        listener(state);
      },
      storeSubscribeoOptions
    );
  }

  protected async setFuture(future: Promise<Value>) {
    this.updateCache((entry) => {
      entry.future = future;
    });

    try {
      const value = await future;
      if (this.cache.getState().get(this.key)?.future === future) {
        this.setValue(value);
      }
    } catch (e) {
      if (this.cache.getState().get(this.key)?.future === future) {
        this.setError(e);
      }
    }
  }
}
