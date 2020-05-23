import { UserInfo, User, PingInfo } from "./users";
import { P2PEvent } from "./message";

export const enum HostPacketType {
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

export const enum ClientPacketType {
    HELLO = "hello",
    DISCONNECT = "disconnect",
    PONG = "pong",
    EVENT = "event",
    ACKNOWLEDGE = "acknowledge",
    UPDATE_USER = "update user",
}

export interface HostPacketWelcome<TUser extends User> {
    packetType: HostPacketType.WELCOME;
    users: UserInfo<TUser>[];
}

export interface HostPacketIncompatible {
    packetType: HostPacketType.INCOMPATIBLE,
    applicationProtocolVersion: string;
    protocolVersion: string;
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

export interface HostPacketRelayedEvent<TPayload> {
    packetType: HostPacketType.RELAYED_EVENT;
    event: P2PEvent<TPayload>;
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

export type HostPacket<TUser extends User, TPayload> =
    | HostPacketWelcome<TUser>
    | HostPacketUserConnected<TUser>
    | HostPacketUserDisconnected
    | HostPacketPing
    | HostPacketRelayedEvent<TPayload>
    | HostPacketAcknowledgedByHost
    | HostPacketAcknowledgedByAll
    | HostPacketPingInfo
    | HostPacketUpdateUser<TUser>
    | HostPacketIncompatible;

export interface ClientPacketHello<TUser extends User> {
    packetType: ClientPacketType.HELLO;
    user: TUser;
    applicationProtocolVersion: string;
    protocolVersion: string;
}

export interface ClientPacketDisconnect {
    packetType: ClientPacketType.DISCONNECT;
}

export interface ClientPacketPong {
    packetType: ClientPacketType.PONG;
    initiationDate: number;
    sequenceNumber: number;
}

export interface ClientPacketEvent<TPayload> {
    packetType: ClientPacketType.EVENT;
    event: P2PEvent<TPayload>;
}

export interface ClientPacketAcknowledge {
    packetType: ClientPacketType.ACKNOWLEDGE;
    serialId: string;
}

export interface ClientPacketUpdateUser<TUser extends User> {
    packetType: ClientPacketType.UPDATE_USER;
    user: Partial<TUser> & User;
}

export type ClientPacket<TUser extends User, TPayload> =
    | ClientPacketHello<TUser>
    | ClientPacketDisconnect
    | ClientPacketPong
    | ClientPacketEvent<TPayload>
    | ClientPacketAcknowledge
    | ClientPacketUpdateUser<TUser>;
