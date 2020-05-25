/**
 * The peer's mode.
 */
export const enum NetworkMode {
    /**
     * The peer is connected as the host.
     */
    HOST = "host",
    /**
     * The peer is connected as the client.
     */
    CLIENT = "client",
    /**
     * The peer is not or no longer connected.
     */
    DISCONNECTED = "disconnected",
    /**
     * The peer is currently connecting.
     */
    CONNECTING = "connecting",
}