import { Host, Client, createHost, createClient } from "../src";
import { MockUser, MockMessageType, mockPeerOptions } from "./utils";

describe("createClient() and createHost()", () => {
    let host: Host<MockUser, MockMessageType>;
    let client: Client<MockUser, MockMessageType>;

    beforeEach(async () => {
        host = await createHost(mockPeerOptions(), { name: "Mr. Host" });
        client = await createClient(mockPeerOptions(), host.hostConnectionId!, { name: "Mr. Client" });
    });

    it("client is client", () => expect(client.isClient).toBe(true));
    it("client is not host", () => expect(client.isHost).toBe(false));
    it("client is connected", () => expect(client.isConnected).toBe(true));
    it("client is not connecting", () => expect(client.isConnecting).toBe(false));
    it("client is not disconnected", () => expect(client.isDisconnected).toBe(false));
    it("host is not client", () => expect(host.isClient).toBe(false));
    it("host is host", () => expect(host.isHost).toBe(true));
});
