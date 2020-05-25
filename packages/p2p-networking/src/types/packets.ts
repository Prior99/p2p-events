import { UserInfo, User, PingInfo } from "./users";
import { Message } from "./message";

/**
 * The versions used by this instance.
 */
export interface Versions {
    /**
     * The version of the application as specified in the options.
     */
    application: string;
    /**
     * The version of this library.
     */
    p2pNetwork: string;
}

export const enum HostPacketType {
    WELCOME = "welcome",
    USER_CONNECTED = "user connected",
    USER_DISCONNECTED = "user disconnected",
    PING = "ping",
    RELAYED_MESSAGE = "relayed message",
    ACKNOWLEDGED_BY_HOST = "acknowledged by host",
    ACKNOWLEDGED_BY_ALL = "acknowledged by all",
    PING_INFO = "ping info",
    UPDATE_USER = "update user",
    INCOMPATIBLE = "incompatible",
}

export const enum ClientPacketType {
    HELLO = "hello",
    DISCONNECT = "disconnect",
    PONG = "pong",
    MESSAGE = "message",
    ACKNOWLEDGE = "acknowledge",
    UPDATE_USER = "update user",
}

export interface HostPacketWelcome<TUser extends User> {
    packetType: HostPacketType.WELCOME;
    users: UserInfo<TUser>[];
}

export interface HostPacketIncompatible {
    packetType: HostPacketType.INCOMPATIBLE;
    versions: Versions;
}

export interface HostPacketUserConnected<TUser extends User> {
    packetType: HostPacketType.USER_CONNECTED;
    user: TUser;
}

export interface HostPacketUserDisconnected {
    packetType: HostPacketType.USER_DISCONNECTED;
    userId: string;
}

export interface HostPacketPing {
    packetType: HostPacketType.PING;
    initiationDate: number;
}

export interface HostPacketRelayedMessage<TMessageType extends string | number, TPayload> {
    packetType: HostPacketType.RELAYED_MESSAGE;
    message: Message<TMessageType, TPayload>;
}

export interface HostPacketAcknowledgedByHost {
    packetType: HostPacketType.ACKNOWLEDGED_BY_HOST;
    serialId: string;
}

export interface HostPacketAcknowledgedByAll {
    packetType: HostPacketType.ACKNOWLEDGED_BY_ALL;
    serialId: string;
}

export interface HostPacketPingInfo {
    packetType: HostPacketType.PING_INFO;
    pingInfos: ({ userId: string } & PingInfo)[];
}

export interface HostPacketUpdateUser<TUser extends User> {
    packetType: HostPacketType.UPDATE_USER;
    user: Partial<TUser> & User;
}

export type HostPacket<TMessageType extends string | number, TUser extends User, TPayload> =
    | HostPacketWelcome<TUser>
    | HostPacketUserConnected<TUser>
    | HostPacketUserDisconnected
    | HostPacketPing
    | HostPacketRelayedMessage<TMessageType, TPayload>
    | HostPacketAcknowledgedByHost
    | HostPacketAcknowledgedByAll
    | HostPacketPingInfo
    | HostPacketUpdateUser<TUser>
    | HostPacketIncompatible;

export interface ClientPacketHello<TUser extends User> {
    packetType: ClientPacketType.HELLO;
    user: TUser;
    versions: Versions;
}

export interface ClientPacketDisconnect {
    packetType: ClientPacketType.DISCONNECT;
}

export interface ClientPacketPong {
    packetType: ClientPacketType.PONG;
    initiationDate: number;
}

export interface ClientPacketMessage<TMessageType extends string | number, TPayload> {
    packetType: ClientPacketType.MESSAGE;
    message: Message<TMessageType, TPayload>;
    targets?: string[];
}

export interface ClientPacketAcknowledge {
    packetType: ClientPacketType.ACKNOWLEDGE;
    serialId: string;
}

export interface ClientPacketUpdateUser<TUser extends User> {
    packetType: ClientPacketType.UPDATE_USER;
    user: Omit<Partial<TUser>, "id">;
}

export type ClientPacket<TMessageType extends string | number, TUser extends User, TPayload> =
    | ClientPacketHello<TUser>
    | ClientPacketDisconnect
    | ClientPacketPong
    | ClientPacketMessage<TMessageType, TPayload>
    | ClientPacketAcknowledge
    | ClientPacketUpdateUser<TUser>;
