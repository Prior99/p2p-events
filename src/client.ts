import PeerJS from "peerjs";
import { User } from "./users";
import { Peer, PeerOpenResult, PeerOptions } from "./peer";
import { ClientMessage, ClientMessageType } from "./messages";
import { libraryVersion } from "../generated/version";

export interface ClientOpenResult extends PeerOpenResult {
    remotePeerId: string;
}

export class Client<TUser extends User, TEventIds = string> extends Peer<TUser, TEventIds> {
    private connection?: PeerJS.DataConnection;

    protected sendClientMessage<TPayload>(message: ClientMessage<TUser, TPayload>): void {
        if (!this.connection) { throw new Error("Can't send message: Connection is not open."); }
        this.sendToPeer(this.connection, message);
    }

    public async open(remotePeerId: string): Promise<ClientOpenResult> {
        const peerOpenResult = await super.createLocalPeer();
        await new Promise(resolve => {
            this.connection = this.peer!.connect(remotePeerId, { reliable: true });
            this.connection.on("open", () => {
                this.connection!.on("data", data => this.handleHostMessage(data));
                this.sendClientMessage({
                    messageType: ClientMessageType.HELLO,
                    applicationProtocolVersion: this.options.applicationProtocolVersion,
                    protocolVersion: libraryVersion,
                    user: this.ownUser,
                });
                resolve();
            });
        });
        return { ...peerOpenResult, remotePeerId };
    }
}