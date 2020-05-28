import PeerJS from "peerjs";
import { Users } from "./users";
import {
    ClientPacket,
    HostPacket,
    HostPacketType,
    ClientPacketType,
    Message,
    PingInfo,
    User,
    NetworkMode,
    ErrorReason,
    Versions,
} from "./types";
import {
    unreachable,
    PromiseListener,
    resolvePromiseListeners,
    rejectPromiseListeners,
    NetworkError,
    IncompatibilityError,
    InternalError,
} from "./utils";
import { v4 as uuid } from "uuid";
import { debug } from "./utils";
import { libraryVersion } from "../generated/version";

/**
 * A handler called when a specific message is received.
 * @param payload The payload transmitted in the message.
 * @param userId The id of the user that sent this message.
 * @param createdDate The date at which the message was sent.
 */
export type MessageHandler<TPayload> = (payload: TPayload, userId: string, createdDate: Date) => void;

/**
 * Can be called to unsubscribe from a subscribed message type.
 */
export type Unsubscribe = () => void;

/**
 * Can be used to perform additional actions on a sent message.
 */
export interface SentMessageHandle<TMessageType extends string | number, TPayload> {
    /**
     * The message that was sent.
     */
    message: Message<TMessageType, TPayload>;
    /**
     * Will return a promise that resolves once the host has received the message.
     */
    waitForHost: () => Promise<void>;
    /**
     * Will return a promise that resolves once all clients (or all targeted clients) have received the message.
     */
    waitForAll: () => Promise<void>;
}

/**
 * Created by `Peer.message()`, this message factory provides actions on a registered message type.
 */
export interface MessageFactory<TMessageType extends string | number, TPayload> {
    /**
     * Subscribe to received instances of these messages.
     * @param handler The handler that will be called once a message of this type is received.
     */
    subscribe: (handler: MessageHandler<TPayload>) => Unsubscribe;
    /**
     * Send an instance of this message to all other peers or a selection of peers.
     * @param payload The payload of the message to send.
     * @param targets An optional selection of targets to send the message to. If omitted, message will be
     *     sent to all targets.
     */
    send: (payload: TPayload, targets?: string | string[]) => SentMessageHandle<TMessageType, TPayload>;
}

/**
 * State (such as subscriptions) kept by the peer about existing message factories.
 */
export interface MessageFactoryState<TMessageType, TPayload> {
    /**
     * The message type that this state is referring to.
     */
    messageType: TMessageType;
    /**
     * Subscriptions on this peer for this message type.
     */
    subscriptions: Set<MessageHandler<TPayload>>;
}

/**
 * State kept about a specific sent message.
 */
export interface SentMessageState<TMessageType extends string | number, TPayload> {
    /**
     * The message that was sent.
     */
    message: Message<TMessageType, TPayload>;
    /**
     * `true` if the host has already acknowledged this message.
     */
    hostHasAcknowledged: boolean;
    /**
     * Listeners that need to be invoked once the host has acknowledged the message.
     */
    waitForHostListeners: Set<PromiseListener<[void], [Error]>>;
    /**
     * Listeners that need to be invoked once all (targeted) peers have acknowledged the message.
     */
    waitForAllListeners: Set<PromiseListener<[void], [Error]>>;
    /**
     * A timeout which will mark the message as timed out if fired.
     * The timeout will be cleared if the message is acknowledged by all (targeted) peers.
     */
    timeout: ReturnType<typeof setTimeout>;
}

/**
 * Options for initializing a peer.
 */
export interface PeerOptions<TUser extends User> {
    /**
     * Time in seconds after which a message is treated as timed out. Defaults to 5 seconds.
     */
    timeout?: number;
    /**
     * The version of this application's "protocol" that is used.
     * If the application is introducing breaking changes, this version should be changed.
     * If a client attempts to connect to a host and this version differs, the connection will be aborted.
     */
    applicationProtocolVersion: string;
    /**
     * Optional options that will be handed to PeerJS when initialized.
     */
    peerJsOptions?: PeerJS.PeerJSOption;
    /**
     * Optional number of seconds for delaying the welcome messages.
     */
    welcomeDelay?: number;
}

/**
 * The result of opening the connection on a peer.
 */
export interface PeerOpenResult {
    /**
     * The internal peer id of this peer. Might be relevant for inviting other peers into this network.
     */
    peerId: string;
    /**
     * The user id of the user associated with this peer.
     */
    userId: string;
}

/**
 * Default options used when initializing a peer.
 */
export const peerDefaultOptions = {
    timeout: 5,
    welcomeDelay: 0.1,
};

export type PeerEventArgumentMapping<TMessageType extends string | number, TUser extends User> = {
    message: [Message<TMessageType, unknown>, string, Date];
    userconnect: [TUser];
    userdisconnect: [string];
    pinginfo: [Map<string, PingInfo>];
    connect: [];
    userupdate: [TUser];
    error: [Error, ErrorReason];
    networkchange: [NetworkMode];
    open: [];
    close: [];
    userreconnect: [TUser];
    userkick: [string];
};

/**
 * An event emitted by a peer.
 */
export type PeerEvent<TMessageType extends string | number, TUser extends User> = keyof PeerEventArgumentMapping<
    TMessageType,
    TUser
>;

export type PeerEventArguments<
    TMessageType extends string | number,
    TEvent extends PeerEvent<TMessageType, TUser>,
    TUser extends User
> = PeerEventArgumentMapping<TMessageType, TUser>[TEvent];

/**
 * A listener for an event emitted by a peer.
 */
export type PeerEventListener<
    TMessageType extends string | number,
    TEvent extends PeerEvent<TMessageType, TUser>,
    TUser extends User
> = (...args: PeerEventArguments<TMessageType, TEvent, TUser>) => void;

/**
 * A participant in the network. Implemented by either `Client` or `Host`.
 */
export abstract class Peer<TUser extends User, TMessageType extends string | number> {
    /**
     * The unique id of the user associated with this peer.
     */
    public userId = uuid();
    /**
     * The options with which this peer was initialized.
     */
    public readonly options: PeerOptions<TUser> & typeof peerDefaultOptions;
    /**
     * The peer id of the host for this network.
     * Can be used to invite other peers into the network.
     */
    public abstract hostConnectionId: string | undefined;
    /**
     * The mode for this peer. Determines whether it is disconnected, connecting or connected as a client or host.
     */
    public networkMode = NetworkMode.DISCONNECTED;

    /**
     * Manages the synchronized state for all users within this network.
     */
    protected userManager = new Users<TUser>();
    /**
     * The underlying PeerJS peer.
     */
    protected peer?: PeerJS;
    /**
     * States (such as subscriptions) kept about registered message types.
     */
    protected messageFactoryStates = new Map<TMessageType, MessageFactoryState<TMessageType, unknown>>();
    /**
     * States (such as listeners) kept about sent messages.
     */
    protected sentMessageStates = new Map<string, SentMessageState<TMessageType, unknown>>();
    /**
     * A set of message serial id's that should be ignored.
     * If any packet referencing a message with one of these serial ids is received, it is ignored.
     */
    protected ignoredSerialIds = new Set<string>();
    /**
     * Event listeners for different events registered on this peer.
     */
    protected eventListeners: {
        [TKey in PeerEvent<TMessageType, TUser>]: Set<PeerEventListener<TMessageType, TKey, TUser>>;
    } = {
        message: new Set(),
        userconnect: new Set(),
        userdisconnect: new Set(),
        pinginfo: new Set(),
        connect: new Set(),
        userupdate: new Set(),
        error: new Set(),
        networkchange: new Set(),
        open: new Set(),
        close: new Set(),
        userreconnect: new Set(),
        userkick: new Set(),
    };
    /**
     * Listeners for the result of updating the user. `.updateUser()` returns a promise that should resolve
     * once the user has been updated. This promise is stored here.
     */
    protected updateUserListeners: PromiseListener<[TUser], [Error]>[] = [];

    /**
     * Create a new peer.
     * @param inputOptions Options used for configuring this peer.
     */
    constructor(inputOptions: PeerOptions<TUser>) {
        this.options = {
            ...peerDefaultOptions,
            ...inputOptions,
        };
    }

    /**
     * Will be `true` if this peer is currently connected to the network as either host
     * or client.
     */
    public get isConnected(): boolean {
        return this.isHost || this.isClient;
    }

    /**
     * Will be `true` while a peer's `open()` method has been called but the connection
     * is not yet established. This can be the case while the peerjs handshake is still
     * being performed or the handshake with the host is still in progress.
     */
    public get isConnecting(): boolean {
        return this.networkMode === NetworkMode.CONNECTING;
    }

    /**
     * Will be `true` if this peer is not connected. This can be the case if a peer was
     * connected but `close()` has be called or if a peer wasn't connected yet.
     */
    public get isDisconnected(): boolean {
        return this.networkMode === NetworkMode.DISCONNECTED;
    }

    /**
     * Will be `true` if this peer is connected to the network as a client.
     */
    public get isClient(): boolean {
        return this.networkMode === NetworkMode.CLIENT;
    }

    /**
     * Will be `true` if this peer is the network's host.
     */
    public get isHost(): boolean {
        return this.networkMode === NetworkMode.HOST;
    }

    /**
     * Will return this user instance associated with this peer.
     */
    public get user(): TUser | undefined {
        return this.userManager.getUser(this.userId);
    }

    /**
     * Will return a copy of the currently connected users.
     */
    public get disconnectedUsers(): TUser[] {
        return this.userManager.all.filter((userInfo) => userInfo.disconnected).map((userInfo) => userInfo.user);
    }

    /**
     * Will return a copy of the currently connected users.
     */
    public get users(): TUser[] {
        return this.userManager.connectedUsers;
    }

    /**
     * Returns a map of all ping informations (lost packets, round trip time, etc.) for each user.
     */
    public get pingInfos(): Map<string, PingInfo> {
        const map = new Map<string, PingInfo>();
        for (const { user, lastPingDate, roundTripTime } of this.userManager.connected) {
            map.set(user.id, { lastPingDate, roundTripTime });
        }
        return map;
    }

    /**
     * Register a new event listener.
     * @param eventName The name of the event to listen for. Must be one of:
     *  * `"message"`: Whenever any message is received.
     *  * `"userconnect"`: Whenever any user connected.
     *  * `"userdisconnect"`: Whenever any disconnected or timed out.
     *  * `"pinginfo"`: Whenever the ping information for all peers were refreshed by the host.
     *  * `"connect"`: When this peer has successfully connected to the host.
     *  * `"userupdate"`: When any user on the network changed their information.
     *  * `"error"`: When any error was encountered.
     *  * `"open"`: When the connection is open and ready to use.
     *  * `"userreconnect"`: When a user reconnected.
     *  * `"userkick"`: When a user is kicked.
     * @param handler The handler that shall be called if the specified event occurs. The arguments
     *    vary depending on the event's type.
     */
    public on<TPeerEvent extends PeerEvent<TMessageType, TUser>>(
        eventName: TPeerEvent,
        handler: (...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>) => void,
    ): void {
        this.eventListeners[eventName].add(handler);
    }

    /**
     * The same as `Peer.on`.
     */
    public addEventListener = this.on;

    /**
     * The same as `Peer.on`, but the listener will only be called once (on the first occurrence of the event).
     * @param eventName The name of the event to listen for. See `Peer.on`.
     * @param handler The handler that shall be called just once.
     */
    public once<TPeerEvent extends PeerEvent<TMessageType, TUser>>(
        eventName: TPeerEvent,
        handler: (...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>) => void,
    ): void {
        const listener = (...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>): void => {
            handler(...args);
            this.removeEventListener(eventName, listener);
        };
        this.on(eventName, listener);
    }

    /**
     * Remove a listener that was previously registered for an event.
     * @param eventName Name of the event to remove this listener for.
     * @param handler The handler to remove.
     */
    public removeEventListener<TPeerEvent extends PeerEvent<TMessageType, TUser>>(
        eventName: TPeerEvent,
        handler: (...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>) => void,
    ): void {
        this.eventListeners[eventName].delete(handler);
    }

    /**
     * Used to emit an event to all registered listeners.
     * @param eventName The name of the event to emit.
     * @param args The arguments to pass to the listeners.
     */
    protected emitEvent<TPeerEvent extends PeerEvent<TMessageType, TUser>>(
        eventName: TPeerEvent,
        ...args: PeerEventArguments<TMessageType, TPeerEvent, TUser>
    ): void {
        const listeners = this.eventListeners[eventName] as Set<PeerEventListener<TMessageType, TPeerEvent, TUser>>;
        listeners.forEach((listener) => listener(...args));
    }

    /**
     * Update the own user on the network.
     * @param user A patch for the own user to change.
     * @returns A promise that will resolve with the updated user once the user was updated.
     */
    public updateUser(user: Omit<Partial<TUser>, "id">): Promise<TUser> {
        this.sendClientPacketToHost({
            packetType: ClientPacketType.UPDATE_USER,
            user,
        });
        return new Promise((resolve, reject) => this.updateUserListeners.push({ resolve, reject }));
    }

    /**
     * Get one user by its id.
     * @param id The id of the user to get.
     * @return The user or `undefined` if none.
     */
    public getUser(id: string): TUser | undefined {
        return this.userManager.getUser(id);
    }

    /**
     * Register a new message on this peer.
     * Will return a factory on which the application can subscribe for message received with this type
     * or to send these messages.
     * @param messageType The type for this message.
     * @returns A factory that can be used subscribe to this kind of message or to send them.
     */
    public message<TPayload>(messageType: TMessageType): MessageFactory<TMessageType, TPayload> {
        const messageFactoryState: MessageFactoryState<TMessageType, TPayload> = {
            messageType,
            subscriptions: new Set(),
        };
        this.messageFactoryStates.set(messageType, messageFactoryState as MessageFactoryState<TMessageType, unknown>);
        const messageFactory: MessageFactory<TMessageType, TPayload> = {
            subscribe: (handler: MessageHandler<TPayload>) => {
                messageFactoryState.subscriptions.add(handler);
                return () => messageFactoryState.subscriptions.delete(handler);
            },
            send: (payload: TPayload, targets?: string | string[]) => {
                const message = this.sendMessageToHost(
                    messageType,
                    payload,
                    typeof targets === "string" ? [targets] : targets,
                );
                const sentMessageState: SentMessageState<TMessageType, TPayload> = {
                    message,
                    waitForHostListeners: new Set(),
                    waitForAllListeners: new Set(),
                    hostHasAcknowledged: false,
                    timeout: setTimeout(() => {
                        const error = new NetworkError(
                            `Timeout: No acknowledge for message "${message.messageType}" with serial "${message.serialId}" within ${this.options.timeout} seconds.`,
                        );
                        if (!sentMessageState?.hostHasAcknowledged) {
                            rejectPromiseListeners(Array.from(sentMessageState.waitForHostListeners.values()), error);
                        }
                        rejectPromiseListeners(Array.from(sentMessageState.waitForAllListeners.values()), error);
                        this.ignoreSerialId(message.serialId);
                        this.sentMessageStates.delete(message.serialId);
                        this.throwError(error);
                    }, this.options.timeout * 1000),
                };
                this.sentMessageStates.set(message.serialId, sentMessageState);
                return {
                    message,
                    waitForHost: () => {
                        return new Promise((resolve, reject) => {
                            sentMessageState.waitForHostListeners.add({ resolve, reject });
                        });
                    },
                    waitForAll: () => {
                        return new Promise((resolve, reject) => {
                            sentMessageState.waitForAllListeners.add({ resolve, reject });
                        });
                    },
                };
            },
        };
        return messageFactory;
    }

    /**
     * Used to throw an error by emitting it as an event.
     * @param error The error to throw and emit.
     */
    protected throwError(error: Error): void {
        const errorReason =
            error instanceof InternalError
                ? ErrorReason.INTERNAL
                : error instanceof NetworkError
                ? ErrorReason.NETWORK
                : error instanceof IncompatibilityError
                ? ErrorReason.INCOMPATIBLE
                : ErrorReason.OTHER;
        this.emitEvent("error", error, errorReason);
    }

    /**
     * Needs to be overridden by the implementing classes.
     * Send an individual packet to the host of the network.
     * @param packet The packet to send.
     */
    protected abstract sendClientPacketToHost<TPayload>(packet: ClientPacket<TMessageType, TUser, TPayload>): void;

    /**
     * Called when a packet is received from the host.
     * @param packet The packet that was received.
     */
    protected handleHostPacket<TPayload>(packet: HostPacket<TMessageType, TUser, TPayload>): void {
        debug("Received packet from host of type %s: %O", packet.packetType, packet);
        switch (packet.packetType) {
            case HostPacketType.KICK_USER: {
                const userInfo = this.userManager.getUserInfo(packet.userId);
                if (!userInfo?.disconnected) {
                    this.emitEvent("userdisconnect", packet.userId);
                }
                this.userManager.removeUser(packet.userId);
                this.emitEvent("userkick", packet.userId);
                break;
            }
            case HostPacketType.RECONNECT_FAILED:
                this.throwError(new Error("Reconnect failed."));
                break;
            case HostPacketType.WELCOME_BACK:
                this.userId = packet.userId;
                this.userManager.initialize(packet.users, true);
                this.emitEvent("connect");
                break;
            case HostPacketType.WELCOME:
                this.userManager.initialize(packet.users);
                this.emitEvent("connect");
                break;
            case HostPacketType.USER_CONNECTED:
                this.userManager.addUser(packet.user);
                this.emitEvent("userconnect", packet.user);
                break;
            case HostPacketType.USER_DISCONNECTED:
                this.userManager.disconnectUser(packet.userId);
                this.emitEvent("userdisconnect", packet.userId);
                break;
            case HostPacketType.USER_RECONNECTED: {
                const user = this.userManager.getUser(packet.userId);
                /* istanbul ignore if */
                if (!user) {
                    this.throwError(new InternalError(`No user with id "${packet.userId}".`));
                    return;
                }
                this.userManager.reconnectUser(packet.userId);
                this.emitEvent("userreconnect", user);
                break;
            }
            case HostPacketType.PING:
                this.sendClientPacketToHost({
                    packetType: ClientPacketType.PONG,
                    initiationDate: packet.initiationDate,
                });
                break;
            case HostPacketType.RELAYED_MESSAGE: {
                const { message } = packet;
                if (this.ignoredSerialIds.has(message.serialId)) {
                    return;
                }
                this.sendClientPacketToHost({
                    packetType: ClientPacketType.ACKNOWLEDGE,
                    serialId: message.serialId,
                });
                const messageFactoryState = this.messageFactoryStates.get(message.messageType);
                /* istanbul ignore if */
                if (!messageFactoryState) {
                    this.throwError(new InternalError(`Received unknown message of type "${message.messageType}".`));
                    return;
                }
                const createdDate = new Date(message.createdDate);
                this.emitEvent("message", message, message.originUserId, createdDate);
                messageFactoryState.subscriptions.forEach((subscription) =>
                    subscription(message.payload, message.originUserId, createdDate),
                );
                break;
            }
            case HostPacketType.ACKNOWLEDGED_BY_HOST: {
                const { serialId } = packet;
                if (this.ignoredSerialIds.has(serialId)) {
                    return;
                }
                const sentMessageState = this.sentMessageStates.get(serialId);
                /* istanbul ignore if */
                if (!sentMessageState) {
                    this.throwError(new InternalError(`No sent message with serial id "${serialId}".`));
                    return;
                }
                sentMessageState.hostHasAcknowledged = true;
                resolvePromiseListeners(Array.from(sentMessageState.waitForHostListeners.values()));
                break;
            }
            case HostPacketType.ACKNOWLEDGED_BY_ALL: {
                const { serialId } = packet;
                if (this.ignoredSerialIds.has(serialId)) {
                    return;
                }
                const sentMessageState = this.sentMessageStates.get(serialId);
                /* istanbul ignore if */
                if (!sentMessageState) {
                    this.throwError(new InternalError(`No sent message with serial id "${serialId}".`));
                    return;
                }
                resolvePromiseListeners(Array.from(sentMessageState.waitForAllListeners.values()));
                clearTimeout(sentMessageState.timeout);
                this.sentMessageStates.delete(serialId);
                break;
            }
            case HostPacketType.PING_INFO: {
                const map = new Map<string, PingInfo>();
                for (const { userId, ...pingInfo } of packet.pingInfos) {
                    try {
                        this.userManager.updatePingInfo(userId, pingInfo);
                    } catch (err) /* istanbul ignore next */ {
                        this.throwError(err);
                        return;
                    }
                    map.set(userId, pingInfo);
                }
                this.emitEvent("pinginfo", map);
                break;
            }
            case HostPacketType.UPDATE_USER:
                try {
                    this.userManager.updateUser(packet.user.id, packet.user);
                } catch (err) {
                    if (packet.user.id === this.userId) {
                        this.updateUserListeners.shift()?.reject(err);
                    }
                    this.throwError(err);
                    return;
                }
                this.emitEvent("userupdate", this.userManager.getUser(packet.user.id)!);
                if (packet.user.id === this.userId) {
                    this.updateUserListeners.shift()?.resolve(this.userManager.getUser(packet.user.id)!);
                }
                break;
            case HostPacketType.INCOMPATIBLE:
                this.throwError(new IncompatibilityError("Incompatible with host.", this.versions, packet.versions));
                break;
            default:
                /* istanbul ignore next */
                unreachable(packet);
        }
    }

    /**
     * The application and library version that this peer is using.
     */
    public get versions(): Versions {
        return {
            application: this.options.applicationProtocolVersion,
            p2pNetwork: libraryVersion,
        };
    }

    /**
     * Terminate the connection.
     */
    public close(): void {
        if (!this.peer) {
            throw new Error("Can't close peer. Not connected.");
        }
        this.sendClientPacketToHost({
            packetType: ClientPacketType.DISCONNECT,
        });
        this.peer.destroy();
        this.networkMode = NetworkMode.DISCONNECTED;
        this.emitEvent("networkchange", this.networkMode);
        this.emitEvent("close");
    }

    /**
     * Create the initial PeerJS connection.
     * @returns A promise that will resolve once the peer is created and ready to connect.
     */
    protected async createLocalPeer(): Promise<PeerOpenResult> {
        this.networkMode = NetworkMode.CONNECTING;
        this.emitEvent("networkchange", this.networkMode);
        try {
            await new Promise((resolve, reject) => {
                this.peer = new PeerJS(null as any, this.options.peerJsOptions); // eslint-disable-line
                this.peer.on("open", () => resolve());
                this.peer.on("error", (error) => reject(error));
            });
        } catch (err) {
            const error = new NetworkError("Connection id could not be determined.");
            this.throwError(error);
            throw error;
        }
        return {
            peerId: this.peer!.id,
            userId: this.userId,
        };
    }

    /**
     * Send an individual host packet to a specific peer.
     * @param connection The peer's connection to send the packet to.
     * @param packet The packet to send.
     */
    protected sendHostPacketToPeer<TPayload>(
        connection: PeerJS.DataConnection,
        packet: HostPacket<TMessageType, TUser, TPayload> | ClientPacket<TMessageType, TUser, TPayload>,
    ): void {
        debug("Sending packet of type %s: %O", packet.packetType, packet);
        connection.send(packet);
    }

    /**
     * Send an individual message packet to the host which will then relay it.
     * @param messageType The type of the message to send.
     * @param payload The message's payload.
     * @param targets An optional subset of target clients to relay the message to.
     * @returns The message as sent to the host.
     */
    protected sendMessageToHost<TPayload>(
        messageType: TMessageType,
        payload: TPayload,
        targets?: string[],
    ): Message<TMessageType, TPayload> {
        const message: Message<TMessageType, TPayload> = {
            messageType,
            originUserId: this.userId,
            payload,
            createdDate: Date.now(),
            serialId: uuid(),
        };
        setTimeout(() =>
            this.sendClientPacketToHost({
                packetType: ClientPacketType.MESSAGE,
                message: message,
                targets,
            }),
        );
        return message;
    }

    /**
     * Add a serial id to the list of ignored serial ids.
     * @param serialId The serial id to ignore.
     */
    public ignoreSerialId(serialId: string): void {
        this.ignoredSerialIds.add(serialId);
    }
}
