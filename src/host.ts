import PeerJS from "peerjs";
import { debug } from "./utils";
import {
    User,
    HostPacket,
    ClientPacket,
    ClientPacketType,
    HostPacketType,
    Message,
    NetworkMode,
} from "./types";
import { Peer, PeerOpenResult, PeerOptions, peerDefaultOptions } from "./peer";
import { unreachable } from "./utils";
import { libraryVersion } from "../generated/version";

export interface ConnectionMeta {
    userId: string;
    lastSequenceNumber: number;
}

export interface RelayedMessageState<TMessageType extends string | number, TPayload> {
    message: Message<TMessageType, TPayload>;
    acknowledgedBy: Set<string>;
    targets?: string[];
}

export interface HostOpenResult extends PeerOpenResult {
    networkId: string;
}

export interface HostOptions<TUser extends User> extends PeerOptions<TUser> {
    pingInterval?: number | undefined;
}

export class Host<TUser extends User, TMessageType extends string | number> extends Peer<TUser, TMessageType> {
    public readonly options: HostOptions<TUser> & typeof peerDefaultOptions;

    protected connections = new Map<string, PeerJS.DataConnection>();
    protected connectionMetas = new Map<string, ConnectionMeta>([
        [
            this.userId,
            {
                userId: this.userId,
                lastSequenceNumber: 0,
            },
        ],
    ]);
    protected relayedMessageStates = new Map<string, RelayedMessageState<TMessageType, any>>(); // eslint-disable-line

    constructor(inputOptions: HostOptions<TUser>) {
        super(inputOptions);
        this.options = {
            ...peerDefaultOptions,
            ...inputOptions,
        };
    }

    public get hostConnectionId(): string | undefined {
        return this.peer?.id;
    }

    public ping(): void {
        this.sendHostPacketToAll({
            packetType: HostPacketType.PING,
            initiationDate: Date.now(),
        });
    }

    public informPing(): void {
        this.sendHostPacketToAll({
            packetType: HostPacketType.PING_INFO,
            pingInfos: this.userManager.all.map(({ lastPingDate, lostPingMessages, roundTripTime, user }) => ({
                lastPingDate,
                lostPingMessages,
                roundTripTime,
                userId: user.id,
            })),
        });
    }

    protected sendHostPacketToAll<TPayload>(packet: HostPacket<TMessageType, TUser, TPayload>): void {
        for (const connection of this.connections.values()) {
            this.sendHostPacketToPeer(connection, packet);
        }
        this.handleHostPacket(packet);
    }

    protected sendHostPacketToUser<TPayload>(userId: string, packet: HostPacket<TMessageType, TUser, TPayload>): void {
        if (userId === this.userId) {
            this.handleHostPacket(packet);
            return;
        }
        const connection = this.connections.get(userId);
        if (!connection) {
            throw new Error(`Can't send message to unknown user with id "${userId}".`);
        }
        this.sendHostPacketToPeer(connection, packet);
    }

    protected handleClientPacket<TPayload>(userId: string, packet: ClientPacket<TMessageType, TUser, TPayload>): void {
        debug("Received packet from client of type %s: %O", packet.packetType, packet);
        const connectionMeta = this.connectionMetas.get(userId);
        if (!connectionMeta) {
            throw new Error(`Connection meta for user "${userId}" missing.`);
        }
        switch (packet.packetType) {
            case ClientPacketType.HELLO:
                throw new Error("Received unexpected hello message from client. Connection already initialized.");
            case ClientPacketType.DISCONNECT:
                this.sendHostPacketToAll({
                    packetType: HostPacketType.USER_DISCONNECTED,
                    userId,
                });
                break;
            case ClientPacketType.PONG:
                this.userManager.updatePingInfo(userId, {
                    lostPingMessages: packet.sequenceNumber - connectionMeta.lastSequenceNumber - 1,
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
                    throw new Error(`User "${userId}" acknowledged message with unknown serial id "${serialId}".`);
                }
                if (relayedMessageState.acknowledgedBy.has(userId)) {
                    throw new Error(`User "${userId}" acknowledged message with serial id "${serialId}" twice.`);
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
                    throw new Error(`User "${userId}" can't update user id.`);
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

    protected sendClientPacketToHost<TPayload>(packet: ClientPacket<TMessageType, TUser, TPayload>): void {
        this.handleClientPacket(this.userId, packet);
    }

    protected handleConnect(connection: PeerJS.DataConnection): void {
        let userId: string;
        connection.on("data", (json) => {
            const message: ClientPacket<TMessageType, TUser, unknown> = json;
            switch (message.packetType) {
                case ClientPacketType.HELLO:
                    userId = message.user.id;
                    if (
                        message.applicationProtocolVersion !== this.options.applicationProtocolVersion ||
                        message.protocolVersion !== libraryVersion
                    ) {
                        this.sendHostPacketToPeer(connection, {
                            packetType: HostPacketType.INCOMPATIBLE,
                            applicationProtocolVersion: this.options.applicationProtocolVersion,
                            protocolVersion: libraryVersion,
                        });
                        break;
                    }
                    this.connectionMetas.set(userId, { lastSequenceNumber: 0, userId });
                    this.sendHostPacketToPeer(connection, {
                        packetType: HostPacketType.WELCOME,
                        users: this.userManager.all,
                    });
                    this.connections.set(userId, connection);
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

    public async open(): Promise<PeerOpenResult> {
        this.networkMode = NetworkMode.CONNECTING;
        const openResult = await super.createLocalPeer();
        if (!this.peer) {
            throw new Error("PeerJS failed to initialize.");
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
