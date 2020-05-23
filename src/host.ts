import PeerJS from "peerjs";
import { User, HostMessage, ClientMessage, ClientMessageType, HostMessageType, P2PEvent } from "./types";
import { Peer, PeerOpenResult, PeerOptions, peerDefaultOptions } from "./peer";
import { unreachable } from "./utils";
import { libraryVersion } from "../generated/version";

export interface ConnectionMeta {
    userId: string;
    lastSequenceNumber: number;
}

export interface RelayedEventManager<TPayload> {
    event: P2PEvent<TPayload>;
    acknowledgedBy: Set<string>;
}

export interface HostOpenResult extends PeerOpenResult {
    networkId: string;
}

export interface HostOptions<TUser extends User> extends PeerOptions<TUser> {
    pingInterval?: number;
}

export class Host<TUser extends User, TEventIds> extends Peer<TUser, TEventIds> {
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
    protected relayedEvents = new Map<string, RelayedEventManager<any>>(); // eslint-disable-line

    constructor(inputOptions: HostOptions<TUser>) {
        super(inputOptions);
        this.options = {
            ...peerDefaultOptions,
            pingInterval: 0,
            ...inputOptions,
        };
    }

    public get hostPeerId(): string | undefined {
        return this.peer?.id;
    }

    public ping(): void {
        this.sendHostMessage({
            messageType: HostMessageType.PING,
            initiationDate: Date.now(),
        });
    }

    public informPing(): void {
        this.sendHostMessage({
            messageType: HostMessageType.PING_INFO,
            pingInfos: this.users.all.map(({ lastPingDate, lostPingMessages, roundTripTime, user }) => ({
                lastPingDate,
                lostPingMessages,
                roundTripTime,
                userId: user.id,
            })),
        });
    }

    protected sendHostMessage<TPayload>(message: HostMessage<TUser, TPayload>): void {
        for (const connection of this.connections.values()) {
            this.sendToPeer(connection, message);
        }
        this.handleHostMessage(message);
    }

    protected sendToUser<TPayload>(userId: string, message: HostMessage<TUser, TPayload>): void {
        if (userId === this.userId) {
            this.handleHostMessage(message);
            return;
        }
        const connection = this.connections.get(userId);
        if (!connection) {
            throw new Error(`Can't send message to unknown user with id "${userId}".`);
        }
        this.sendToPeer(connection, message);
    }

    protected handleClientMessage<TEventPayload>(userId: string, message: ClientMessage<TUser, TEventPayload>): void {
        const connectionMeta = this.connectionMetas.get(userId);
        if (!connectionMeta) {
            throw new Error(`Inconsistency detected: Connection meta for user "${userId}" missing.`);
        }
        switch (message.messageType) {
            case ClientMessageType.HELLO:
                throw new Error("Received unexpected hello message from client. Connection already initialized.");
            case ClientMessageType.DISCONNECT:
                this.sendHostMessage({
                    messageType: HostMessageType.USER_DISCONNECTED,
                    userId,
                });
                break;
            case ClientMessageType.PONG:
                this.users.updatePingInfo(userId, {
                    lostPingMessages: message.sequenceNumber - connectionMeta.lastSequenceNumber - 1,
                    roundTripTime: Date.now() - message.initiationDate,
                    lastPingDate: Date.now(),
                });
                break;
            case ClientMessageType.EVENT: {
                const { event } = message;
                const { serialId } = event;
                this.relayedEvents.set(event.serialId, { event, acknowledgedBy: new Set() });
                this.sendToUser(userId, {
                    messageType: HostMessageType.ACKNOWLEDGED_BY_HOST,
                    serialId,
                });
                this.sendHostMessage({
                    messageType: HostMessageType.RELAYED_EVENT,
                    event,
                });
                break;
            }
            case ClientMessageType.ACKNOWLEDGE: {
                const { serialId } = message;
                const relayedEvent = this.relayedEvents.get(serialId);
                if (!relayedEvent) {
                    throw new Error(
                        `Inconsistency detected: User "${userId}" acknowledged event with unknown serial id "${serialId}".`,
                    );
                }
                if (relayedEvent.acknowledgedBy.has(userId)) {
                    throw new Error(
                        `Inconsistency detected: User "${userId}" acknowledged event with serial id "${serialId}" twice.`,
                    );
                }
                relayedEvent.acknowledgedBy.add(userId);
                if (relayedEvent.acknowledgedBy.size === this.users.count) {
                    this.sendToUser(relayedEvent.event.originUserId, {
                        messageType: HostMessageType.ACKNOWLEDGED_BY_ALL,
                        serialId,
                    });
                    this.relayedEvents.delete(serialId);
                }
                break;
            }
            case ClientMessageType.UPDATE_USER:
                if (message.user.id !== undefined) {
                    throw new Error(`Inconsistency detected: User "${userId}" can't update user id.`);
                }
                this.users.updateUser(userId, message.user);
                break;
            default:
                unreachable(message);
        }
    }

    protected sendClientMessage<TPayload>(message: ClientMessage<TUser, TPayload>): void {
        this.handleClientMessage(this.userId, message);
    }

    protected handleConnect(connection: PeerJS.DataConnection): void {
        let userId: string;
        connection.on("data", (json) => {
            const message: ClientMessage<TUser, unknown> = json;
            switch (message.messageType) {
                case ClientMessageType.HELLO:
                    userId = message.user.id;
                    if (
                        message.applicationProtocolVersion !== this.options.applicationProtocolVersion ||
                        message.protocolVersion !== libraryVersion
                    ) {
                        this.sendToPeer(connection, {
                            messageType: HostMessageType.INCOMPATIBLE,
                            applicationProtocolVersion: this.options.applicationProtocolVersion,
                            protocolVersion: libraryVersion,
                        });
                        break;
                    }
                    this.connectionMetas.set(userId, { lastSequenceNumber: 0, userId });
                    this.sendToPeer(connection, {
                        messageType: HostMessageType.WELCOME,
                        users: this.users.all,
                    });
                    this.connections.set(userId, connection);
                    this.sendHostMessage({
                        messageType: HostMessageType.USER_CONNECTED,
                        user: message.user,
                    });
                    break;
                default:
                    this.handleClientMessage(userId, message);
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
