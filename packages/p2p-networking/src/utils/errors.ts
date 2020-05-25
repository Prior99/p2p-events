import { Versions } from "../types";

/**
 * The error hat internal reasons, caused by a bug in the protocol or this library.
 */
export class InternalError extends Error {}

export const enum IncompatibleVersion {
    APPLICATION_PROTOCOL_VERSION = "application protocol version",
    P2P_NETWORK_VERSION = "protocol version",
}

/**
 * The error was caused by the application or library being incompatible.
 */
export class IncompatibilityError extends Error {
    constructor(message: string, public localVersions: Versions, public hostVersions: Versions) {
        super(message);
    }

    public get incompatibleVersions(): IncompatibleVersion[] {
        if (
            this.hostVersions.application !== this.localVersions.application &&
            this.hostVersions.p2pNetwork !== this.localVersions.p2pNetwork
        ) {
            return [IncompatibleVersion.APPLICATION_PROTOCOL_VERSION, IncompatibleVersion.P2P_NETWORK_VERSION];
        }
        if (this.hostVersions.application !== this.localVersions.application) {
            return [IncompatibleVersion.APPLICATION_PROTOCOL_VERSION];
        }
        if (this.hostVersions.p2pNetwork !== this.localVersions.p2pNetwork) {
            return [IncompatibleVersion.P2P_NETWORK_VERSION];
        }
        return [];
    }
}

export class NetworkError extends Error {}
