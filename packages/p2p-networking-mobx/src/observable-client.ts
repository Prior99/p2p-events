import { User, Client, ClientOpenResult, PeerOptions } from "p2p-networking";
import { ObservablePeer } from "./observable-peer";
import { Public } from "./types";

export class ObservableClient<TUser extends User, TMessageType extends string | number>
    extends ObservablePeer<TUser, TMessageType>
    implements Public<Client<TUser, TMessageType>> {

    constructor(inputOptions: PeerOptions<TUser>) {
        super(new Client(inputOptions));
    }

    public get client(): Client<TUser, TMessageType> {
        return this.peer as Client<TUser, TMessageType>;
    }

    public open(remotePeerId: string): Promise<ClientOpenResult> {
        return this.client.open(remotePeerId);
    }
}

export async function createObservableClient<TUser extends User, TMessageType extends string | number>(
    options: PeerOptions<TUser>,
    remotePeerId: string,
): Promise<ObservableClient<TUser, TMessageType>> {
    const client = new ObservableClient<TUser, TMessageType>(options);
    await client.open(remotePeerId);
    return client;
}
