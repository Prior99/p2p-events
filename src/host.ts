import PeerJS from "peerjs";
import { User, HostPacket, ClientPacket, ClientPacketType, HostPacketType, Message } from "./types";
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
}

export interface HostOpenResult extends PeerOpenResult {
    networkId: string;
}

export interface HostOptions<TUser extends User> extends PeerOptions<TUser> {
    pingInterval?: number;
}

export class Host<TUser extends User, TMessageType extends string | number> extends Peer<TUser, TMessageType> {
    public readonly options: Required<HostOptions<TUser>>;

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
            pingInterval: 0,
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
            this.sendToPeer(connection, packet);
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
        this.sendToPeer(connection, packet);
    }

    protected handleClientPacket<TPayload>(userId: string, packet: ClientPacket<TMessageType, TUser, TPayload>): void {
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
                    roundTripTime: Date.now() - packet.initiationDate,
                    lastPingDate: Date.now(),
                });
                break;
            case ClientPacketType.MESSAGE: {
                const { message } = packet;
                const { serialId } = message;
                this.relayedMessageStates.set(message.serialId, { message, acknowledgedBy: new Set() });
                this.sendHostPacketToUser(userId, {
                    packetType: HostPacketType.ACKNOWLEDGED_BY_HOST,
                    serialId,
                });
                this.sendHostPacketToAll({
                    packetType: HostPacketType.RELAYED_MESSAGE,
                    message,
                });
                break;
            }
            case ClientPacketType.ACKNOWLEDGE: {
                const { serialId } = packet;
                const relatedMessageState = this.relayedMessageStates.get(serialId);
                if (!relatedMessageState) {
                    throw new Error(`User "${userId}" acknowledged message with unknown serial id "${serialId}".`);
                }
                if (relatedMessageState.acknowledgedBy.has(userId)) {
                    throw new Error(`User "${userId}" acknowledged message with serial id "${serialId}" twice.`);
                }
                relatedMessageState.acknowledgedBy.add(userId);
                if (relatedMessageState.acknowledgedBy.size === this.userManager.count) {
                    this.sendHostPacketToUser(relatedMessageState.message.originUserId, {
                        packetType: HostPacketType.ACKNOWLEDGED_BY_ALL,
                        serialId,
                    });
                    this.relayedMessageStates.delete(serialId);
                }
                break;
            }
            case ClientPacketType.UPDATE_USER:
                if (packet.user.id !== undefined) {
                    throw new Error(`User "${userId}" can't update user id.`);
                }
                this.userManager.updateUser(userId, packet.user);
                break;
            default:
                unreachable(packet);
        }
    }

    protected sendClientPacket<TPayload>(packet: ClientPacket<TMessageType, TUser, TPayload>): void {
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
                        this.sendToPeer(connection, {
                            packetType: HostPacketType.INCOMPATIBLE,
                            applicationProtocolVersion: this.options.applicationProtocolVersion,
                            protocolVersion: libraryVersion,
                        });
                        break;
                    }
                    this.connectionMetas.set(userId, { lastSequenceNumber: 0, userId });
                    this.sendToPeer(connection, {
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
        const openResult = await super.createLocalPeer();
        if (!this.peer) {
            throw new Error("PeerJS failed to initialize.");
        }
        this.peer.on("connection", (connection) => this.handleConnect(connection));
        if (this.options.pingInterval > 0) {
            setInterval(() => {
                this.ping();
                this.informPing();
            }, this.options.pingInterval);
        }
        return openResult;
    }
}
