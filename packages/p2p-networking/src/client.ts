import PeerJS from "peerjs";
import { Peer, PeerOpenResult, PeerOptions } from "./peer";
import { ClientPacket, ClientPacketType, User, NetworkMode } from "./types";
import { libraryVersion } from "../generated/version";

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
     * @param userInit If reconnecting to a previously disconnected session, provide the user id.
     *     Otherwise, if connecting initially, provide a user.
     * @returns A promise resolving once the client is fully connected.
     */
    public async open(remotePeerId: string, userInit: string | Omit<TUser, "id">): Promise<ClientOpenResult> {
        const peerOpenResult = await super.createLocalPeer();
        this.networkMode = NetworkMode.CLIENT;
        this.emitEvent("networkchange", this.networkMode);
        await new Promise((resolve, reject) => {
            this.connection = this.peer!.connect(remotePeerId, { reliable: true });
            const errorListener = (error: unknown): void => {
                this.connection!.off("error", errorListener);
                reject(error);
            };
            this.connection.on("close", () => {
                this.networkMode = NetworkMode.DISCONNECTED;
                this.emitEvent("networkchange", this.networkMode);
                this.emitEvent("close");
            });
            this.connection.on("error", errorListener);
            this.connection.on("open", async () => {
                this.connection!.on("data", (data) => this.handleHostPacket(data));
                // In order to avoid collision in Safari and Chrome on Windows, wait until greeting.
                await new Promise((resolve) => setTimeout(resolve, this.options.welcomeDelay * 1000));
                if (typeof userInit === "string") {
                    this.sendClientPacketToHost({
                        packetType: ClientPacketType.HELLO_AGAIN,
                        versions: {
                            application: this.options.applicationProtocolVersion,
                            p2pNetwork: libraryVersion,
                        },
                        userId: userInit,
                    });
                } else {
                    const user = { ...userInit, id: this.userId } as TUser;
                    this.userManager.addUser(user);
                    this.sendClientPacketToHost({
                        packetType: ClientPacketType.HELLO,
                        versions: {
                            application: this.options.applicationProtocolVersion,
                            p2pNetwork: libraryVersion,
                        },
                        user,
                    });
                }
                const peerErrorListener = (error: Error): void => {
                    this.removeEventListener("error", peerErrorListener);
                    reject(error);
                };
                this.once("error", peerErrorListener);
                this.once("connect", () => {
                    this.removeEventListener("error", peerErrorListener);
                    resolve();
                });
            });
        });

        this.hostConnectionId = remotePeerId;
        this.emitEvent("open");

        return { ...peerOpenResult, remotePeerId };
    }
}

/**
 * Creates a new instance of `Client` and connects it to the specified host.
 * @see Client
 * @param options Options to use for connecting.
 * @param remotePeerId The peer id of the host to connect to.
 * @param user If reconnecting to a previously disconnected session, provide the user id.
 *     Otherwise, if connecting initially, provide a user.
 * @returns A promise resolving with the client once the client is fully connected.
 */
export async function createClient<TUser extends User, TMessageType extends string | number>(
    options: PeerOptions<TUser>,
    remotePeerId: string,
    user: string | Omit<TUser, "id">,
): Promise<Client<TUser, TMessageType>> {
    const client = new Client<TUser, TMessageType>(options);
    await client.open(remotePeerId, user);
    return client;
}
