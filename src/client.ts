import PeerJS from "peerjs";
import { Peer, PeerOpenResult } from "./peer";
import { ClientPacket, ClientPacketType, User } from "./types";
import { libraryVersion } from "../generated/version";

export interface ClientOpenResult extends PeerOpenResult {
    remotePeerId: string;
}

export class Client<TUser extends User, TMessageType extends string | number> extends Peer<TUser, TMessageType> {
    private connection?: PeerJS.DataConnection;

    public hostConnectionId: string | undefined;

    protected sendClientPacketToHost<TPayload>(message: ClientPacket<TMessageType, TUser, TPayload>): void {
        if (!this.connection) {
            this.throwError(new Error("Can't send message: Connection is not open."));
        }
        this.sendHostPacketToPeer(this.connection, message);
    }

    public async open(remotePeerId: string): Promise<ClientOpenResult> {
        const peerOpenResult = await super.createLocalPeer();
        await new Promise((resolve) => {
            this.connection = this.peer!.connect(remotePeerId, { reliable: true });
            this.connection.on("open", () => {
                this.connection!.on("data", (data) => this.handleHostPacket(data));
                this.sendClientPacketToHost({
                    packetType: ClientPacketType.HELLO,
                    versions: {
                        application: this.options.applicationProtocolVersion,
                        p2pNetwork: libraryVersion,
                    },
                    user: this.ownUser,
                });
                resolve();
            });
        });

        this.hostConnectionId = remotePeerId;

        return { ...peerOpenResult, remotePeerId };
    }
}
