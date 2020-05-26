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
