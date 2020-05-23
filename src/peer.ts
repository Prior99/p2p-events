import PeerJS from "peerjs";
import { Users } from "./users";
import { ClientPacket, HostPacket, HostPacketType, ClientPacketType, Message, PingInfo, User } from "./types";
import { unreachable, PromiseListener, resolvePromiseListeners, rejectPromiseListeners } from "./utils";
import { v4 as uuid } from "uuid";

export type MessageHandler<TPayload> = (payload: TPayload, userId: string, createdDate: Date) => void;
export type Unsubscribe = () => void;

export interface SentMessageHandle<TMessageType extends string | number, TPayload> {
    message: Message<TMessageType, TPayload>;
    waitForHost: () => Promise<void>;
    waitForAll: () => Promise<void>;
}

export interface MessageFactory<TMessageType extends string | number, TPayload> {
    subscribe: (handler: MessageHandler<TPayload>) => Unsubscribe;
    send: (payload: TPayload) => SentMessageHandle<TMessageType, TPayload>;
}

export interface MessageFactoryState<TMessageType, TPayload> {
    messageType: TMessageType;
    subscriptions: Set<MessageHandler<TPayload>>;
}

export interface SentMessageState<TMessageType extends string | number, TPayload> {
    message: Message<TMessageType, TPayload>;
    waitForHostListeners: Set<PromiseListener<[void], [Error]>>;
    waitForAllListeners: Set<PromiseListener<[void], [Error]>>;
    timeout: ReturnType<typeof setTimeout>;
}

export interface PeerOptions<TUser extends User> {
    timeout?: number;
    applicationProtocolVersion: string;
    user: Omit<TUser, "id">;
}

export interface PeerOpenResult {
    peerId: string;
    userId: string;
}

export const peerDefaultOptions = {
    timeout: 5,
};

export type PeerEventArgumentMapping<TMessageType extends string | number, TUser extends User> = {
    message: [Message<TMessageType, unknown>, string, Date];
    userconnect: [TUser];
    userdisconnect: [string];
    pinginfo: [Map<string, PingInfo>];
    connect: [];
    userupdate: [TUser];
};
export type PeerEvent<TMessageType extends string | number, TUser extends User> = keyof PeerEventArgumentMapping<
    TMessageType,
    TUser
>;
export type PeerEventArguments<
    TMessageType extends string | number,
    TEvent extends PeerEvent<TMessageType, TUser>,
    TUser extends User
> = PeerEventArgumentMapping<TMessageType, TUser>[TEvent];
export type PeerEventListener<
    TMessageType extends string | number,
    TEvent extends PeerEvent<TMessageType, TUser>,
    TUser extends User
> = (...args: PeerEventArguments<TMessageType, TEvent, TUser>) => void;

export abstract class Peer<TUser extends User, TMessageType extends string | number> {
    public userId = uuid();

    public readonly options: Required<PeerOptions<TUser>>;
    public abstract hostConnectionId: string | undefined;

    protected userManager = new Users<TUser>();
    protected peer?: PeerJS;
    protected messageFactoryStates = new Map<TMessageType, MessageFactoryState<TMessageType, any>>(); // eslint-disable-line
    protected sentMessageStates = new Map<string, SentMessageState<TMessageType, any>>(); // eslint-disable-line
    protected ignoredSerialIds = new Set<string>();
    protected sequenceNumber = 0;
    protected eventListeners: {
        [TKey in PeerEvent<TMessageType, TUser>]: Set<PeerEventListener<TMessageType, TKey, TUser>>;
    } = {
        message: new Set(),
        userconnect: new Set(),
        userdisconnect: new Set(),
        pinginfo: new Set(),
        connect: new Set(),
        userupdate: new Set(),
    };

    constructor(inputOptions: PeerOptions<TUser>) {
        this.userManager.addUser({
            ...inputOptions.user,
            id: this.userId,
        } as any); // eslint-disable-line
        this.options = {
            ...peerDefaultOptions,
            ...inputOptions,
        };
    }

    public get ownUser(): TUser {
        return this.userManager.getUser(this.userId)!;
    }

    public get users(): TUser[] {
        return this.userManager.allUsers;
    }

    public get pingInfos(): Map<string, PingInfo> {
        const map = new Map<string, PingInfo>();
        for (const { user, lastPingDate, lostPingMessages, roundTripTime } of this.userManager.all) {
            map.set(user.id, { lastPingDate, lostPingMessages, roundTripTime });
        }
        return map;
    }

    public on<TPeerEvent extends PeerEvent<TMessageType, TUser>>(
        eventName: TPeerEvent,
        handler: (...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>) => void,
    ): void {
        this.eventListeners[eventName].add(handler);
    }

    public addEventListener = this.on;

    public removeEventListener<TPeerEvent extends PeerEvent<TMessageType, TUser>>(
        eventName: TPeerEvent,
        handler: (...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>) => void,
    ): void {
        this.eventListeners[eventName].delete(handler);
    }

    protected emitEvent<TPeerEvent extends PeerEvent<TMessageType, TUser>>(
        eventName: TPeerEvent,
        ...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>
    ): void {
        const listeners = this.eventListeners[eventName] as Set<PeerEventListener<TMessageType, TPeerEvent, TUser>>;
        listeners.forEach((listener) => listener(...args));
    }

    public updateUser(user: Partial<TUser>): void {
        this.sendClientPacket({
            packetType: ClientPacketType.UPDATE_USER,
            user: {
                ...user,
                id: this.userId,
            },
        });
    }

    public message<TPayload>(messageType: TMessageType): MessageFactory<TMessageType, TPayload> {
        const eventMeta: MessageFactoryState<TMessageType, TPayload> = {
            messageType,
            subscriptions: new Set(),
        };
        this.messageFactoryStates.set(messageType, eventMeta);
        const messageFactory: MessageFactory<TMessageType, TPayload> = {
            subscribe: (handler: MessageHandler<TPayload>) => {
                eventMeta.subscriptions.add(handler);
                return () => eventMeta.subscriptions.delete(handler);
            },
            send: (payload: TPayload) => {
                const message = this.sendMessage(messageType, payload);
                const pendingEventManager: SentMessageState<TMessageType, TPayload> = {
                    message,
                    waitForHostListeners: new Set(),
                    waitForAllListeners: new Set(),
                    timeout: setTimeout(() => {
                        const error = new Error(
                            `Timeout: No acknowledge for event "${message.messageType}" with serial "${message.serialId}" within ${this.options.timeout} seconds.`,
                        );
                        rejectPromiseListeners(Array.from(pendingEventManager.waitForHostListeners.values()), error);
                        rejectPromiseListeners(Array.from(pendingEventManager.waitForAllListeners.values()), error);
                        this.ignoreSerialId(message.serialId);
                        this.sentMessageStates.delete(message.serialId);
                    }, this.options.timeout * 1000),
                };
                this.sentMessageStates.set(message.serialId, pendingEventManager);
                return {
                    message,
                    waitForHost: () => {
                        return new Promise((resolve, reject) => {
                            pendingEventManager.waitForHostListeners.add({ resolve, reject });
                        });
                    },
                    waitForAll: () => {
                        return new Promise((resolve, reject) => {
                            pendingEventManager.waitForAllListeners.add({ resolve, reject });
                        });
                    },
                };
            },
        };
        return messageFactory;
    }

    protected abstract sendClientPacket<TEventPayload>(packet: ClientPacket<TMessageType, TUser, TEventPayload>): void;

    protected handleHostPacket<TEventPayload>(packet: HostPacket<TMessageType, TUser, TEventPayload>): void {
        switch (packet.packetType) {
            case HostPacketType.WELCOME:
                this.userManager.initialize(packet.users);
                this.emitEvent("connect");
                break;
            case HostPacketType.USER_CONNECTED:
                this.userManager.addUser(packet.user);
                this.emitEvent("userconnect", packet.user);
                break;
            case HostPacketType.USER_DISCONNECTED:
                this.userManager.removeUser(packet.userId);
                this.emitEvent("userdisconnect", packet.userId);
                break;
            case HostPacketType.PING:
                this.sendClientPacket({
                    packetType: ClientPacketType.PONG,
                    initiationDate: packet.initiationDate,
                    sequenceNumber: ++this.sequenceNumber,
                });
                break;
            case HostPacketType.RELAYED_MESSAGE: {
                const { message } = packet;
                if (this.ignoredSerialIds.has(message.serialId)) {
                    return;
                }
                this.sendClientPacket({
                    packetType: ClientPacketType.ACKNOWLEDGE,
                    serialId: message.serialId,
                });
                const eventManager = this.messageFactoryStates.get(message.messageType);
                if (!eventManager) {
                    throw new Error(`Received unknown event with id "${message.messageType}".`);
                }
                const createdDate = new Date(message.createdDate);
                this.emitEvent("message", message, message.originUserId, createdDate);
                eventManager.subscriptions.forEach((subscription) =>
                    subscription(message.payload, message.originUserId, createdDate),
                );
                break;
            }
            case HostPacketType.ACKNOWLEDGED_BY_HOST: {
                const { serialId } = packet;
                if (this.ignoredSerialIds.has(serialId)) {
                    return;
                }
                const pendingEvent = this.sentMessageStates.get(serialId);
                if (!pendingEvent) {
                    throw new Error(`Inconsistency detected. No pending event with serial id "${serialId}".`);
                }
                resolvePromiseListeners(Array.from(pendingEvent.waitForHostListeners.values()));
                break;
            }
            case HostPacketType.ACKNOWLEDGED_BY_ALL: {
                const { serialId } = packet;
                if (this.ignoredSerialIds.has(serialId)) {
                    return;
                }
                const pendingEvent = this.sentMessageStates.get(serialId);
                if (!pendingEvent) {
                    throw new Error(`Inconsistency detected. No pending event with serial id "${serialId}".`);
                }
                resolvePromiseListeners(Array.from(pendingEvent.waitForAllListeners.values()));
                clearTimeout(pendingEvent.timeout);
                this.sentMessageStates.delete(serialId);
                break;
            }
            case HostPacketType.PING_INFO: {
                const map = new Map<string, PingInfo>();
                for (const { userId, ...pingInfo } of packet.pingInfos) {
                    this.userManager.updatePingInfo(userId, pingInfo);
                    map.set(userId, pingInfo);
                }
                this.emitEvent("pinginfo", map);
                break;
            }
            case HostPacketType.UPDATE_USER:
                this.userManager.updateUser(packet.user.id, packet.user);
                this.emitEvent("userupdate", this.userManager.getUser(packet.user.id)!);
                break;
            case HostPacketType.INCOMPATIBLE:
                throw new Error("Incompatible with host.");
                break;
            default:
                unreachable(packet);
        }
    }

    public close(): void {
        if (!this.peer) {
            throw new Error("Can't close peer. Not connected.");
        }
        this.sendClientPacket({
            packetType: ClientPacketType.DISCONNECT,
        });
        this.peer.destroy();
    }

    protected async createLocalPeer(): Promise<PeerOpenResult> {
        await new Promise((resolve) => {
            this.peer = new PeerJS(null as any, { host: "localhost", port: 9000, path: "/myapp" }); // eslint-disable-line
            this.peer.on("open", () => resolve());
        });
        if (!this.peer) {
            throw new Error("Connection id could not be determined.");
        }
        return {
            peerId: this.peer.id,
            userId: this.userId,
        };
    }

    protected sendToPeer<TPayload>(
        connection: PeerJS.DataConnection,
        message: HostPacket<TMessageType, TUser, TPayload> | ClientPacket<TMessageType, TUser, TPayload>,
    ): void {
        connection.send(message);
    }

    protected sendMessage<TPayload>(messageType: TMessageType, payload: TPayload): Message<TMessageType, TPayload> {
        const message: Message<TMessageType, TPayload> = {
            messageType,
            originUserId: this.userId,
            payload,
            createdDate: Date.now(),
            serialId: uuid(),
        };
        setTimeout(() =>
            this.sendClientPacket({
                packetType: ClientPacketType.MESSAGE,
                message: message,
            }),
        );
        return message;
    }

    public ignoreSerialId(serialId: string): void {
        this.ignoredSerialIds.add(serialId);
    }
}
