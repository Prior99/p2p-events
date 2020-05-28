import { UserInfo, User, PingInfo } from "./types";
import { InternalError } from "./utils";

export class Users<TUser extends User> {
    private users = new Map<string, UserInfo<TUser>>();

    public addUser(user: TUser): void {
        this.users.set(user.id, {
            user,
            lastPingDate: Date.now(),
            roundTripTime: undefined,
            disconnected: false,
        });
    }

    public removeUser(userId: string): void {
        this.users.delete(userId);
    }

    public reconnectUser(userId: string): void {
        const user = this.users.get(userId);
        if (!user) {
            throw new InternalError(`No user with id "${userId}".`);
        }
        user.disconnected = false;
    }

    public disconnectUser(userId: string): void {
        const user = this.users.get(userId);
        if (!user) {
            throw new InternalError(`No user with id "${userId}".`);
        }
        user.disconnected = true;
    }

    public getUserInfo(userId: string): UserInfo<TUser> | undefined {
        return this.users.get(userId);
    }

    public getUser(userId: string): TUser | undefined {
        return this.getUserInfo(userId)?.user;
    }

    public updateUser(userId: string, update: Omit<Partial<TUser>, "id">): void {
        const userInfo = this.users.get(userId);
        /* istanbul ignore if */
        if (!userInfo) {
            throw new InternalError(`No user with id "${userId}".`);
        }
        this.users.set(userId, {
            ...userInfo,
            user: {
                ...userInfo.user,
                ...update,
            },
        });
    }

    public updatePingInfo(userId: string, update: Partial<PingInfo>): void {
        const userInfo = this.users.get(userId);
        /* istanbul ignore if */
        if (!userInfo) {
            throw new InternalError(`No user with id "${userId}".`);
        }
        this.users.set(userId, {
            ...userInfo,
            ...update,
        });
    }

    public initialize(users: UserInfo<TUser>[], clear = false): void {
        if (clear) {
            this.users.clear();
        }
        for (const { user, lastPingDate, roundTripTime } of users) {
            this.addUser(user);
            this.updatePingInfo(user.id, { lastPingDate, roundTripTime });
        }
    }

    public get allUsers(): TUser[] {
        return this.all.map(({ user }) => user);
    }

    public get all(): UserInfo<TUser>[] {
        return Array.from(this.users.values()).sort((a, b) => a.user.id.localeCompare(b.user.id));
    }

    public get connectedUsers(): TUser[] {
        return this.connected.map(({ user }) => user);
    }

    public get connected(): UserInfo<TUser>[] {
        return this.all.filter((user) => !user.disconnected);
    }

    public get connectedCount(): number {
        return this.connected.length;
    }
}
