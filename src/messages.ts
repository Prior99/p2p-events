import { UserInfo, User, PingInfo } from "./users";
import { P2PEvent } from "./p2p-event";

export const enum HostMessageType {
    WELCOME = "welcome",
    USER_CONNECTED = "user connected",
    USER_DISCONNECTED = "user disconnected",
    PING = "ping",
    RELAYED_EVENT = "relayed event",
    ACKNOWLEDGED_BY_HOST = "acknowledged by host",
    ACKNOWLEDGED_BY_ALL = "acknowledged by all",
    PING_INFO = "ping info",
    UPDATE_USER = "update user",
    INCOMPATIBLE = "incompatible",
}

export const enum ClientMessageType {
    HELLO = "hello",
    DISCONNECT = "disconnect",
    PONG = "pong",
    EVENT = "event",
    ACKNOWLEDGE = "acknowledge",
    UPDATE_USER = "update user",
}

export interface HostMessageWelcome<TUser extends User> {
    messageType: HostMessageType.WELCOME;
    users: UserInfo<TUser>[];
}

export interface HostMessageIncompatible {
    messageType: HostMessageType.INCOMPATIBLE,
    applicationProtocolVersion: string;
    protocolVersion: string;
}

export interface HostMessageUserConnected<TUser extends User> {
    messageType: HostMessageType.USER_CONNECTED;
    user: TUser;
}

export interface HostMessageUserDisconnected {
    messageType: HostMessageType.USER_DISCONNECTED;
    userId: string;
}

export interface HostMessagePing {
    messageType: HostMessageType.PING;
    initiationDate: number;
}

export interface HostMessageRelayedEvent<TPayload> {
    messageType: HostMessageType.RELAYED_EVENT;
    event: P2PEvent<TPayload>;
}

export interface HostMessageAcknowledgedByHost {
    messageType: HostMessageType.ACKNOWLEDGED_BY_HOST;
    serialId: string;
}

export interface HostMessageAcknowledgedByAll {
    messageType: HostMessageType.ACKNOWLEDGED_BY_ALL;
    serialId: string;
}

export interface HostMessagePingInfo {
    messageType: HostMessageType.PING_INFO;
    pingInfos: ({ userId: string } & PingInfo)[];
}

export interface HostMessageUpdateUser<TUser extends User> {
    messageType: HostMessageType.UPDATE_USER;
    user: Partial<TUser> & User;
}

export type HostMessage<TUser extends User, TPayload> =
    | HostMessageWelcome<TUser>
    | HostMessageUserConnected<TUser>
    | HostMessageUserDisconnected
    | HostMessagePing
    | HostMessageRelayedEvent<TPayload>
    | HostMessageAcknowledgedByHost
    | HostMessageAcknowledgedByAll
    | HostMessagePingInfo
    | HostMessageUpdateUser<TUser>
    | HostMessageIncompatible;

export interface ClientMessageHello<TUser extends User> {
    messageType: ClientMessageType.HELLO;
    user: TUser;
    applicationProtocolVersion: string;
    protocolVersion: string;
}

export interface ClientMessageDisconnect {
    messageType: ClientMessageType.DISCONNECT;
}

export interface ClientMessagePong {
    messageType: ClientMessageType.PONG;
    initiationDate: number;
    sequenceNumber: number;
}

export interface ClientMessageEvent<TPayload> {
    messageType: ClientMessageType.EVENT;
    event: P2PEvent<TPayload>;
}

export interface ClientMessageAcknowledge {
    messageType: ClientMessageType.ACKNOWLEDGE;
    serialId: string;
}

export interface ClientMessageUpdateUser<TUser extends User> {
    messageType: ClientMessageType.UPDATE_USER;
    user: Partial<TUser> & User;
}

export type ClientMessage<TUser extends User, TPayload> =
    | ClientMessageHello<TUser>
    | ClientMessageDisconnect
    | ClientMessagePong
    | ClientMessageEvent<TPayload>
    | ClientMessageAcknowledge
    | ClientMessageUpdateUser<TUser>;
