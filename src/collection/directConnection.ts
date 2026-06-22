import {
  ClientConnection,
  ServerConnection,
  type CollectionDownMessage,
  type CollectionUpMessage,
} from '@collection/connection';

class Client<TUser> extends ClientConnection {
  constructor(protected getServer: () => Server<TUser>) {
    super();
  }

  send(domain: string, messages: CollectionUpMessage[]): void {
    this.getServer().receive(domain, messages);
  }
}

class Server<TUser> extends ServerConnection<TUser> {
  constructor(protected getClient: () => Client<TUser>) {
    super();
  }

  send(domain: string, messages: CollectionDownMessage[]): void {
    this.getClient().receive(domain, messages);
  }
}

export class DirectConnection<TUser> {
  client: Client<TUser> = new Client(() => this.server);
  server: Server<TUser> = new Server(() => this.client);

  constructor(user?: TUser) {
    this.server.user = user;
  }
}
