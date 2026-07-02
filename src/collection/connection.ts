import type { DisposableCancel } from '@core';
import disposable from '@lib/disposable';

export type CollectionMessage =
  | [op: 'update', update: unknown]
  | [op: 'delete', id: unknown, t: number]
  | [op: 'clear', t: number];

export type CollectionUpMessage =
  | CollectionMessage
  | [op: 'enable', query: unknown, t: number | null]
  | [op: 'disable', query: unknown];

export type CollectionDownMessage = CollectionMessage | [op: 'init', query: unknown];

export abstract class Connection<TIn, TOut> {
  protected listeners: Set<{
    domain: string;
    onMessage: (message: TIn) => void;
  }> = new Set();

  onMessage(domain: string, onMessage: (message: TIn) => void): DisposableCancel {
    const listener = { domain, onMessage };
    this.listeners.add(listener);

    return disposable(() => {
      this.listeners.delete(listener);
    });
  }

  receive(domain: string, messages: TIn[]): void {
    for (const listener of this.listeners) {
      if (listener.domain === domain) {
        for (const message of messages) {
          listener.onMessage(message);
        }
      }
    }
  }

  abstract send(domain: string, messages: TOut[]): void;
}

export abstract class ClientConnection extends Connection<
  CollectionDownMessage,
  CollectionUpMessage
> {
  reconnectListeners: Set<{
    domain: string;
    onReconnect: () => void;
  }> = new Set();

  onReconnect(domain: string, onReconnect: () => void): DisposableCancel {
    const listener = { domain, onReconnect };
    this.reconnectListeners.add(listener);

    return disposable(() => {
      this.reconnectListeners.delete(listener);
    });
  }

  protected notifyReconnect(): void {
    for (const listener of this.reconnectListeners) {
      listener.onReconnect();
    }
  }
}

export abstract class ServerConnection<TUser> extends Connection<
  CollectionUpMessage,
  CollectionDownMessage
> {
  user?: TUser;
}
