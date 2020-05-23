import PeerJS from "peerjs";
import { Peer, PeerOpenResult } from "./peer";
import { ClientPacket, ClientPacketType, User } from "./types";
import { libraryVersion } from "../generated/version";

export interface ClientOpenResult extends PeerOpenResult {
    remotePeerId: string;
}

export class Client<TUser extends User, TEventIds> extends Peer<TUser, TEventIds> {
    private connection?: PeerJS.DataConnection;

    public hostPeerId: string | undefined;

    protected sendClientMessage<TPayload>(message: ClientPacket<TUser, TPayload>): void {
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
                    messageType: ClientPacketType.HELLO,
                    applicationProtocolVersion: this.options.applicationProtocolVersion,
                    protocolVersion: libraryVersion,
                    user: this.ownUser,
                });
                resolve();
            });
        });

        this.hostPeerId = remotePeerId;
        
        return { ...peerOpenResult, remotePeerId };
    }
}