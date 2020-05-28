import { Peer, User, NetworkMode, PeerOptions, Versions, PingInfo } from "p2p-networking";
import { observable, computed, action } from "mobx";
import { Public } from "./types";

export abstract class ObservablePeer<TUser extends User, TMessageType extends string | number>
    implements Public<Peer<TUser, TMessageType>> {
    @observable public userId: string;
    @observable public hostConnectionId: string | undefined;
    @observable public networkMode: NetworkMode;
    @observable public pingInfos = new Map<string, PingInfo>();

    @observable private userMap = new Map<string, TUser>();

    constructor(public peer: Peer<TUser, TMessageType>) {
        this.userId = this.peer.userId;
        this.hostConnectionId = this.peer.hostConnectionId;
        this.networkMode = this.peer.networkMode;

        this.peer.on(
            "userconnect",
            action((user) => this.userMap.set(user.id, user)),
        );
        this.peer.on(
            "userdisconnect",
            action((userId) => this.userMap.delete(userId)),
        );
        this.peer.on(
            "userreconnect",
            action((user) => this.userMap.set(user.id, user)),
        );
        this.peer.on(
            "userupdate",
            action((user) => this.userMap.set(user.id, user)),
        );
        this.peer.on(
            "networkchange",
            action((networkMode) => (this.networkMode = networkMode)),
        );
        this.peer.on(
            "open",
            action(() => {
                for (const user of this.peer.users) {
                    this.userMap.set(user.id, user);
                }
                this.pingInfos = peer.pingInfos;
                this.hostConnectionId = peer.hostConnectionId;
            }),
        );
        this.peer.on(
            "pinginfo",
            action(() => (this.pingInfos = peer.pingInfos)),
        );
    }

    public get versions(): Versions {
        return this.peer.versions;
    }

    public get options(): PeerOptions<TUser> & { timeout: number } {
        return this.peer.options;
    }

    @computed public get isConnected(): boolean {
        return this.isHost || this.isClient;
    }

    @computed public get isConnecting(): boolean {
        return this.networkMode === NetworkMode.CONNECTING;
    }

    @computed public get isDisconnected(): boolean {
        return this.networkMode === NetworkMode.DISCONNECTED;
    }

    @computed public get isClient(): boolean {
        return this.networkMode === NetworkMode.CLIENT;
    }

    @computed public get isHost(): boolean {
        return this.networkMode === NetworkMode.HOST;
    }

    @computed public get user(): TUser {
        return this.userMap.get(this.userId)!;
    }

    @computed public get users(): TUser[] {
        return Array.from(this.userMap.values()).sort((a, b) => a.id.localeCompare(b.id));
    }

    public getUser: Peer<TUser, TMessageType>["getUser"] = (...args) => this.peer.getUser(...args);
    public on: Peer<TUser, TMessageType>["on"] = (...args) => this.peer.on(...args);
    public addEventListener: Peer<TUser, TMessageType>["addEventListener"] = (...args) =>
        this.peer.addEventListener(...args);
    public once: Peer<TUser, TMessageType>["once"] = (...args) => this.peer.once(...args);
    public removeEventListener: Peer<TUser, TMessageType>["removeEventListener"] = (...args) =>
        this.peer.removeEventListener(...args);
    public updateUser: Peer<TUser, TMessageType>["updateUser"] = (...args) => this.peer.updateUser(...args);
    public message: Peer<TUser, TMessageType>["message"] = (...args) => this.peer.message(...args);
    public close: Peer<TUser, TMessageType>["close"] = (...args) => this.peer.close(...args);
    public ignoreSerialId: Peer<TUser, TMessageType>["ignoreSerialId"] = (...args) => this.peer.ignoreSerialId(...args);
}
