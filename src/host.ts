import PeerJS from "peerjs";
import { debug, InternalError, NetworkError } from "./utils";
import { User, HostPacket, ClientPacket, ClientPacketType, HostPacketType, Message, NetworkMode } from "./types";
import { Peer, PeerOpenResult, PeerOptions, peerDefaultOptions } from "./peer";
import { unreachable } from "./utils";
import { libraryVersion } from "../generated/version";

/**
 * Meta information about one connection to this host.
 */
export interface Connection {
    /**
     * The actual PeerJS connection with the client.
     */
    dataConnection?: PeerJS.DataConnection;
    /**
     * The id of the user associated with this connection.
     */
    userId: string;
    /**
     * A sequencenumber incremented by onw with each ping packet.
     * Used to detect lost packets.
     */
    lastSequenceNumber: number;
}

/**
 * State the host needs to manage for an individual relayed message.
 */
export interface RelayedMessageState<TMessageType extends string | number, TPayload> {
    /**
     * The message this state is about.
     */
    message: Message<TMessageType, TPayload>;
    /**
     * Set of user ids of users that already acknowledged this message.
     */
    acknowledgedBy: Set<string>;
    /**
     * If specified, the message was only realayed to these users.
     */
    targets?: string[];
}

export interface HostOptions<TUser extends User> extends PeerOptions<TUser> {
    pingInterval?: number | undefined;
}

/**
 * A peer participating as host in the network.
 */
export class Host<TUser extends User, TMessageType extends string | number> extends Peer<TUser, TMessageType> {
    /**
     * The options specified when this instance was created.
     */
    public readonly options: HostOptions<TUser> & typeof peerDefaultOptions;

    /**
     * All PeerJS connections to this host associated with their corresponding user ids.
     */
    protected connections = new Map<string, Connection>([
        [
            this.userId,
            {
                userId: this.userId,
                lastSequenceNumber: 0,
            },
        ],
    ]);
    /**
     * States about messages currently being relayed by this host.
     */
    protected relayedMessageStates = new Map<string, RelayedMessageState<TMessageType, any>>(); // eslint-disable-line

    /**
     * @param inputOptions Options used by this instance.
     */
    constructor(inputOptions: HostOptions<TUser>) {
        super(inputOptions);
        this.options = {
            ...peerDefaultOptions,
            ...inputOptions,
        };
    }

    /**
     * The peer id of the host of this network.
     * Can be used to invite other peers into this network.
     */
    public get hostConnectionId(): string | undefined {
        return this.peer?.id;
    }

    /**
     * Perform a single ping throughout the network, determining the round trip time or to find disconnected clients.
     */
    public ping(): void {
        this.sendHostPacketToAll({
            packetType: HostPacketType.PING,
            initiationDate: Date.now(),
        });
    }

    /**
     * Publish the ping information determined by `ping()` with all clients in the network.
     */
    public informPing(): void {
        this.sendHostPacketToAll({
            packetType: HostPacketType.PING_INFO,
            pingInfos: this.userManager.all.map(({ lastPingDate, lostPingPackets, roundTripTime, user }) => ({
                lastPingDate,
                lostPingPackets,
                roundTripTime,
                userId: user.id,
            })),
        });
    }

    /**
     * Send a packet to all peers in the network, including this peer.
     * @param packet The packet to send.
     */
    protected sendHostPacketToAll<TPayload>(packet: HostPacket<TMessageType, TUser, TPayload>): void {
        for (const { dataConnection } of this.connections.values()) {
            if (dataConnection) {
                this.sendHostPacketToPeer(dataConnection, packet);
            } else {
                this.handleHostPacket(packet);
            }
        }
    }

    /**
     * Send a packet to one specific user in the network.
     * @param packet The packet to send.
     */
    protected sendHostPacketToUser<TPayload>(userId: string, packet: HostPacket<TMessageType, TUser, TPayload>): void {
        const connection = this.connections.get(userId);
        if (!connection) {
            this.throwError(new InternalError(`Can't send message to unknown user with id "${userId}".`));
        }
        const { dataConnection } = connection;
        if (!dataConnection) {
            this.handleHostPacket(packet);
        } else {
            this.sendHostPacketToPeer(dataConnection, packet);
        }
    }

    /**
     * Called when a packet is received from a client.
     * @param userId The user id of the user associated with the connection this packet came from.
     * @param packet The packet that was received.
     */
    protected handleClientPacket<TPayload>(userId: string, packet: ClientPacket<TMessageType, TUser, TPayload>): void {
        debug("Received packet from client of type %s: %O", packet.packetType, packet);
        const connection = this.connections.get(userId);
        if (!connection) {
            this.throwError(new InternalError(`Connection meta for user "${userId}" missing.`));
        }
        switch (packet.packetType) {
            case ClientPacketType.HELLO:
                this.throwError(
                    new InternalError("Received unexpected hello message from client. Connection already initialized."),
                );
                break;
            case ClientPacketType.DISCONNECT:
                this.sendHostPacketToAll({
                    packetType: HostPacketType.USER_DISCONNECTED,
                    userId,
                });
                break;
            case ClientPacketType.PONG:
                this.userManager.updatePingInfo(userId, {
                    lostPingPackets: packet.sequenceNumber - connection.lastSequenceNumber - 1,
                    roundTripTime: (Date.now() - packet.initiationDate) / 1000,
                    lastPingDate: Date.now(),
                });
                break;
            case ClientPacketType.MESSAGE: {
                const { message, targets } = packet;
                const { serialId } = message;
                this.relayedMessageStates.set(message.serialId, { message, acknowledgedBy: new Set(), targets });
                this.sendHostPacketToUser(userId, {
                    packetType: HostPacketType.ACKNOWLEDGED_BY_HOST,
                    serialId,
                });
                const packetToSend = {
                    packetType: HostPacketType.RELAYED_MESSAGE as const,
                    message,
                };
                if (targets) {
                    targets.forEach((target) => {
                        this.sendHostPacketToUser(target, packetToSend);
                    });
                } else {
                    this.sendHostPacketToAll(packetToSend);
                }
                break;
            }
            case ClientPacketType.ACKNOWLEDGE: {
                const { serialId } = packet;
                const relayedMessageState = this.relayedMessageStates.get(serialId);
                if (!relayedMessageState) {
                    this.throwError(
                        new InternalError(
                            `User "${userId}" acknowledged message with unknown serial id "${serialId}".`,
                        ),
                    );
                }
                if (relayedMessageState.acknowledgedBy.has(userId)) {
                    this.throwError(
                        new InternalError(`User "${userId}" acknowledged message with serial id "${serialId}" twice.`),
                    );
                }
                relayedMessageState.acknowledgedBy.add(userId);
                if (
                    relayedMessageState.acknowledgedBy.size ===
                    (relayedMessageState.targets?.length ?? this.userManager.count)
                ) {
                    this.sendHostPacketToUser(relayedMessageState.message.originUserId, {
                        packetType: HostPacketType.ACKNOWLEDGED_BY_ALL,
                        serialId,
                    });
                    this.relayedMessageStates.delete(serialId);
                }
                break;
            }
            case ClientPacketType.UPDATE_USER:
                if ("id" in packet.user) {
                    this.throwError(new InternalError(`User "${userId}" can't update user id.`));
                }
                this.sendHostPacketToAll({
                    packetType: HostPacketType.UPDATE_USER,
                    user: {
                        ...packet.user,
                        id: userId,
                    },
                });
                break;
            default:
                unreachable(packet);
        }
    }

    /**
     * Send one packet to the host.
     * @param packet The packet to send to the host.
     */
    protected sendClientPacketToHost<TPayload>(packet: ClientPacket<TMessageType, TUser, TPayload>): void {
        this.handleClientPacket(this.userId, packet);
    }

    /**
     * Called when a new connection is made (new client connected).
     * @param dataConnection The new connection.
     */
    protected handleConnect(dataConnection: PeerJS.DataConnection): void {
        let userId: string;
        dataConnection.on("data", (json) => {
            const message: ClientPacket<TMessageType, TUser, unknown> = json;
            switch (message.packetType) {
                case ClientPacketType.HELLO:
                    userId = message.user.id;
                    if (
                        message.versions.application !== this.options.applicationProtocolVersion ||
                        message.versions.p2pNetwork !== libraryVersion
                    ) {
                        this.sendHostPacketToPeer(dataConnection, {
                            packetType: HostPacketType.INCOMPATIBLE,
                            versions: {
                                application: this.options.applicationProtocolVersion,
                                p2pNetwork: libraryVersion,
                            },
                        });
                        break;
                    }
                    this.connections.set(userId, { dataConnection, lastSequenceNumber: 0, userId });
                    this.sendHostPacketToPeer(dataConnection, {
                        packetType: HostPacketType.WELCOME,
                        users: this.userManager.all,
                    });
                    this.sendHostPacketToAll({
                        packetType: HostPacketType.USER_CONNECTED,
                        user: message.user,
                    });
                    break;
                default:
                    this.handleClientPacket(userId, message);
                    break;
            }
        });
    }

    /**
     * Start accepting connections.
     * @returns Promise that resolves once the host is ready to accept connections.
     */
    public async open(): Promise<PeerOpenResult> {
        this.networkMode = NetworkMode.CONNECTING;
        const openResult = await super.createLocalPeer();
        if (!this.peer) {
            this.throwError(new NetworkError("PeerJS failed to initialize."));
        }
        this.peer.on("connection", (connection) => this.handleConnect(connection));
        if (this.options.pingInterval !== undefined) {
            setInterval(() => {
                this.ping();
                this.informPing();
            }, this.options.pingInterval * 1000);
        }
        this.networkMode = NetworkMode.HOST;
        return openResult;
    }
}

/**
 * Create a new host and wait for it to be ready to accept connections.
 * @param options Options to hand to the host.
 * @returns A promise that resolves with the instance once the host is ready to accept connections.
 */
export async function createHost<TUser extends User, TMessageType extends string | number>(
    options: HostOptions<TUser>,
): Promise<Host<TUser, TMessageType>> {
    const host = new Host<TUser, TMessageType>(options);
    await host.open();
    return host;
}
