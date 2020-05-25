export interface User {
    /**
     * The user's unique id.
     */
    id: string;
}

export interface PingInfo {
    /**
     * The date of the last ping as a unix timestamp in milliseconds.
     */
    lastPingDate: number;
    /**
     * The time it took for one packet to travel from the client to the host and back.
     * In seconds.
     */
    roundTripTime: number | undefined;
}

export interface UserInfo<TUser extends User> extends PingInfo {
    user: TUser;
}