export interface User {
    id: string;
}

export interface PingInfo {
    lastPingDate: number;
    roundTripTime: number | undefined;
    lostPingMessages: number;
}

export interface UserInfo<TUser extends User> extends PingInfo {
    user: TUser;
}