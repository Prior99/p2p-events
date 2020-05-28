import { User, Client, PeerOptions } from "p2p-networking";
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

    public open: Client<TUser, TMessageType>["open"] = (...args) => this.client.open(...args);
}

export async function createObservableClient<TUser extends User, TMessageType extends string | number>(
    options: PeerOptions<TUser>,
    remotePeerId: string,
    user: string | Omit<TUser, "id">,
): Promise<ObservableClient<TUser, TMessageType>> {
    const client = new ObservableClient<TUser, TMessageType>(options);
    await client.open(remotePeerId, user);
    return client;
}
