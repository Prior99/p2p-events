import PeerJS from "peerjs";
import { debug, InternalError, NetworkError, PromiseListener } from "./utils";
import {
    User,
    HostPacket,
    ClientPacket,
    ClientPacketType,
    HostPacketType,
    Message,
    NetworkMode,
    ErrorReason,
    Versions,
} from "./types";
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

export interface PendingPing {
    listener: PromiseListener<[], [Error]>;
    returned: Set<string>;
    timeout: ReturnType<typeof setTimeout>;
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
            },
        ],
    ]);
    /**
     * States about messages currently being relayed by this host.
     */
    protected relayedMessageStates = new Map<string, RelayedMessageState<TMessageType, any>>(); // eslint-disable-line
    /**
     * A list of listeners waiting for ping packets to return from all clients.
     */
    protected pendingPings: PendingPing[] = [];
    /**
     * An optional interval handler for pinging.
     */
    protected pingInterval?: ReturnType<typeof setInterval>;

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

    private handlePingTimeout(pendingPing: PendingPing): void {
        this.pendingPings = this.pendingPings.filter((current) => current !== pendingPing);
        for (const userId of this.connections.keys()) {
            if (pendingPing.returned.has(userId)) {
                continue;
            }
            this.emitEvent("error", new NetworkError(`Client with id "${userId}" timed out.`), ErrorReason.NETWORK);
            this.closeConnectionToClient(userId);
        }
        pendingPing.listener.reject(new NetworkError("Not all pings returned within timeout."));
    }

    /**
     * Closes the connection to one specific client.
     * @param userId The user id of the user associated with the connection to close.
     */
    public closeConnectionToClient(userId: string): void {
        const connection = this.connections.get(userId);
        if (userId === this.userId) {
            throw new Error("Host can't close connection to itself.");
        }
        if (!connection) {
            this.throwError(new InternalError("Can't close connection to unknown client."));
            return;
        }
        connection.dataConnection!.close();
        this.connections.delete(userId);
        this.sendHostPacketToAll({
            packetType: HostPacketType.USER_DISCONNECTED,
            userId,
        });
    }

    /**
     * Perform a single ping throughout the network, determining the round trip time or to find disconnected clients.
     * @returns A promise that will resolve once all connected clients answered the ping.
     *     It will reject if a client timed out.
     */
    public async ping(): Promise<void> {
        const promise = new Promise((resolve, reject) => {
            const pendingPing: PendingPing = {
                listener: { resolve, reject },
                returned: new Set(),
                timeout: setTimeout(() => this.handlePingTimeout(pendingPing), this.options.timeout * 1000),
            };
            this.pendingPings.push(pendingPing);
        });
        this.sendHostPacketToAll({
            packetType: HostPacketType.PING,
            initiationDate: Date.now(),
        });
        await promise;
        this.sendHostPacketToAll({
            packetType: HostPacketType.PING_INFO,
            pingInfos: this.userManager.all.map(({ lastPingDate, roundTripTime, user }) => ({
                lastPingDate,
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
        /* istanbul ignore if */
        if (!connection) {
            this.throwError(new InternalError(`Can't send message to unknown user with id "${userId}".`));
            return;
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
        /* istanbul ignore if */
        if (!connection) {
            this.throwError(new InternalError(`Connection meta for user "${userId}" missing.`));
            return;
        }
        switch (packet.packetType) {
            /* istanbul ignore next */
            case ClientPacketType.HELLO:
            case ClientPacketType.HELLO_AGAIN:
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
            case ClientPacketType.PONG: {
                this.userManager.updatePingInfo(userId, {
                    roundTripTime: (Date.now() - packet.initiationDate) / 1000,
                    lastPingDate: Date.now(),
                });
                const pending = this.pendingPings.find((pending) => !pending.returned.has(userId));
                /* istanbul ignore if */
                if (!pending) {
                    this.throwError(new InternalError("Received pong for unknown ping."));
                    return;
                }
                pending.returned.add(userId);
                if (pending.returned.size === this.connections.size) {
                    clearTimeout(pending.timeout);
                    this.pendingPings = this.pendingPings.filter((other) => other !== pending);
                    pending.listener.resolve();
                }
                break;
            }
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
                    targets.forEach((target: string) => {
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
                /* istanbul ignore if */
                if (!relayedMessageState) {
                    this.throwError(
                        new InternalError(
                            `User "${userId}" acknowledged message with unknown serial id "${serialId}".`,
                        ),
                    );
                    return;
                }
                /* istanbul ignore if */
                if (relayedMessageState.acknowledgedBy.has(userId)) {
                    this.throwError(
                        new InternalError(`User "${userId}" acknowledged message with serial id "${serialId}" twice.`),
                    );
                    return;
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
                /* istanbul ignore if */
                if ("id" in packet.user) {
                    this.throwError(new InternalError(`User "${userId}" can't update user id.`));
                    return;
                }
                this.sendHostPacketToAll({
                    packetType: HostPacketType.UPDATE_USER,
                    user: {
                        ...packet.user,
                        id: userId,
                    },
                });
                break;
            /* istanbul ignore next */
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

    private checkVersions(versions: Versions, dataConnection: PeerJS.DataConnection): boolean {
        if (
            versions.application !== this.options.applicationProtocolVersion ||
            versions.p2pNetwork !== libraryVersion
        ) {
            this.sendHostPacketToPeer(dataConnection, {
                packetType: HostPacketType.INCOMPATIBLE,
                versions: {
                    application: this.options.applicationProtocolVersion,
                    p2pNetwork: libraryVersion,
                },
            });
            return false;
        }
        return true;
    }

    /**
     * Called when a new connection is made (new client connected).
     * @param dataConnection The new connection.
     */
    protected handleConnect(dataConnection: PeerJS.DataConnection): void {
        let userId: string;
        dataConnection.on("data", async (json) => {
            const message: ClientPacket<TMessageType, TUser, unknown> = json;
            switch (message.packetType) {
                case ClientPacketType.HELLO:
                    userId = message.user.id;
                    if (!this.checkVersions(message.versions, dataConnection)) {
                        break;
                    }
                    this.connections.set(userId, { dataConnection, userId });
                    // In order to avoid collision in Safari and Chrome on Windows, wait until greeting.
                    await new Promise((resolve) => setTimeout(resolve, this.options.welcomeDelay * 1000));
                    this.sendHostPacketToPeer(dataConnection, {
                        packetType: HostPacketType.WELCOME,
                        users: this.userManager.all,
                    });
                    // In order to avoid collision in Safari and Chrome on Windows, wait until announcing.
                    await new Promise((resolve) => setTimeout(resolve, this.options.welcomeDelay * 1000));
                    this.sendHostPacketToAll({
                        packetType: HostPacketType.USER_CONNECTED,
                        user: message.user,
                    });
                    break;
                case ClientPacketType.HELLO_AGAIN:
                    userId = message.userId;
                    if (!this.checkVersions(message.versions, dataConnection)) {
                        break;
                    }
                    this.connections.set(userId, { dataConnection, userId });
                    // In order to avoid collision in Safari and Chrome on Windows, wait until greeting.
                    await new Promise((resolve) => setTimeout(resolve, this.options.welcomeDelay * 1000));
                    this.sendHostPacketToPeer(dataConnection, {
                        packetType: HostPacketType.WELCOME_BACK,
                        users: this.userManager.all,
                        userId,
                    });
                    // In order to avoid collision in Safari and Chrome on Windows, wait until announcing.
                    await new Promise((resolve) => setTimeout(resolve, this.options.welcomeDelay * 1000));
                    this.sendHostPacketToAll({
                        packetType: HostPacketType.USER_RECONNECTED,
                        userId,
                    });
                    break;
                default:
                    this.handleClientPacket(userId, message);
                    break;
            }
        });
    }

    public startPing(): void {
        if (this.options.pingInterval !== undefined) {
            this.pingInterval = setInterval(() => this.ping(), this.options.pingInterval * 1000);
        }
    }

    public stopPing(): void {
        if (!this.pingInterval) {
            return;
        }
        clearInterval(this.pingInterval);
    }

    /**
     * Start accepting connections.
     * @returns Promise that resolves once the host is ready to accept connections.
     */
    public async open(): Promise<PeerOpenResult> {
        const openResult = await super.createLocalPeer();
        this.peer!.on("connection", (connection) => this.handleConnect(connection));
        this.startPing();
        this.networkMode = NetworkMode.HOST;
        this.emitEvent("networkchange", this.networkMode);
        this.emitEvent("open");
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
