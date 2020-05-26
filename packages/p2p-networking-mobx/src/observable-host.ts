import { User, Host, HostOptions, PeerOpenResult } from "p2p-networking";
import { ObservablePeer } from "./observable-peer";
import { Public } from "./types";

export class ObservableHost<TUser extends User, TMessageType extends string | number>
    extends ObservablePeer<TUser, TMessageType>
    implements Public<Host<TUser, TMessageType>> {
    constructor(inputOptions: HostOptions<TUser>) {
        super(new Host(inputOptions));
    }

    public closeConnectionToClient: Host<TUser, TMessageType>["closeConnectionToClient"] = (...args) =>
        this.host.closeConnectionToClient(...args);
    public ping: Host<TUser, TMessageType>["ping"] = (...args) => this.host.ping(...args);
    public startPing: Host<TUser, TMessageType>["startPing"] = (...args) => this.host.startPing(...args);
    public stopPing: Host<TUser, TMessageType>["stopPing"] = (...args) => this.host.stopPing(...args);

    public get host(): Host<TUser, TMessageType> {
        return this.peer as Host<TUser, TMessageType>;
    }

    public open(): Promise<PeerOpenResult> {
        return this.host.open();
    }
}

export async function createObservableHost<TUser extends User, TMessageType extends string | number>(
    options: HostOptions<TUser>,
): Promise<ObservableHost<TUser, TMessageType>> {
    const host = new ObservableHost<TUser, TMessageType>(options);
    await host.open();
    return host;
}
