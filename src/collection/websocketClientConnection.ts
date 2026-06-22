import {
  ClientConnection,
  type CollectionDownMessage,
  type CollectionUpMessage,
} from '@collection/connection';

export class WebSocketClientConnection extends ClientConnection implements Disposable {
  ws?: WebSocket;

  constructor() {
    super();
    this.start();
  }

  protected start(): void {
    const isReconnect = !!this.ws;

    this.ws = new WebSocket(window.location.origin.replace(/^http/, 'ws'));

    this.ws.addEventListener('open', () => {
      if (isReconnect) {
        this.notifyReconnect();
      }
    });

    this.ws.addEventListener('close', () => {
      setTimeout(() => this.start(), 5000);
    });

    this.ws.addEventListener('message', (event) => {
      const [domain, messages] = JSON.parse(event.data) as [
        domain: string,
        messages: CollectionDownMessage[],
      ];

      this.receive(domain, messages);
    });
  }

  send(domain: string, messages: CollectionUpMessage[]): void {
    if (!this.ws) {
      throw new Error('WebSocket connection is not established');
    }

    this.ws.send(JSON.stringify([domain, messages]));
  }

  [Symbol.dispose](): void {
    this.ws?.close();
  }
}
