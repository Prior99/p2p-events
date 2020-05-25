import PeerJS from "peerjs";
import { Peer, PeerOpenResult, PeerOptions } from "./peer";
import { ClientPacket, ClientPacketType, User } from "./types";
import { libraryVersion } from "../generated/version";
import { PromiseListener } from "./utils";

/**
 * The result of opening a client connection.
 */
export interface ClientOpenResult extends PeerOpenResult {
    /**
     * The peer id of the peer the client is connected to.
     * This is likely the host's peer id.
     * It can be used to invite other peers into the network.
     */
    remotePeerId: string;
}

/**
 * A client peer in the network.
 */
export class Client<TUser extends User, TMessageType extends string | number> extends Peer<TUser, TMessageType> {
    /**
     * The underlying PeerJS connection to the host.
     */
    private connection?: PeerJS.DataConnection;
    /**
     * The peer id of the host. Can be used to invite other peers into the network.
     */
    public hostConnectionId: string | undefined;

    /**
     * Send an individual packet to the host.
     * @param packet The packet to send.
     */
    protected sendClientPacketToHost<TPayload>(packet: ClientPacket<TMessageType, TUser, TPayload>): void {
        if (!this.connection) {
            this.throwError(new Error("Can't send message: Connection is not open."));
            return;
        }
        this.sendHostPacketToPeer(this.connection, packet);
    }

    /**
     * Connect to a network.
     *
     * @param remotePeerId The id of the peer to connect to.
     *
     * @returns A promise resolving once the client is fully connected.
     */
    public async open(remotePeerId: string): Promise<ClientOpenResult> {
        const peerOpenResult = await super.createLocalPeer();
        await new Promise((resolve, reject) => {
            this.connection = this.peer!.connect(remotePeerId, { reliable: true });
            const errorListener = (error: unknown): void => {
                reject(error);
                this.connection?.off("error", errorListener);
            };
            this.connection.on("error", errorListener);
            this.connection.on("open", () => {
                this.connection!.on("data", (data) => this.handleHostPacket(data));
                this.sendClientPacketToHost({
                    packetType: ClientPacketType.HELLO,
                    versions: {
                        application: this.options.applicationProtocolVersion,
                        p2pNetwork: libraryVersion,
                    },
                    user: this.user,
                });
                this.once("connect", () => resolve());
            });
        });

        this.hostConnectionId = remotePeerId;

        return { ...peerOpenResult, remotePeerId };
    }
}

/**
 * Creates a new instance of `Client` and connects it to the specified host.
 * @see Client
 * @param options Options to use for connecting.
 * @param remotePeerId The peer id of the host to connect to.
 * @returns A promise resolving with the client once the client is fully connected.
 */
export async function createClient<TUser extends User, TMessageType extends string | number>(
    options: PeerOptions<TUser>,
    remotePeerId: string,
): Promise<Client<TUser, TMessageType>> {
    const client = new Client<TUser, TMessageType>(options);
    await client.open(remotePeerId);
    return client;
}
