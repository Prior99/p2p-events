jest.mock("peerjs");
import { Host, Client, ClientMessageType, HostMessageType } from "../src";
import { resetHistory, getHistory } from "./message-history";
import { libraryVersion } from "../generated/version";

interface MockUser {
    id: string;
    name: string;
}

describe("Simple", () => {
    let host: Host<MockUser>;
    let client: Client<MockUser>;
    let hostPeerId: string;
    let clientPeerId: string;

    beforeEach(async () => {
        resetHistory();
        host = new Host({ applicationProtocolVersion: "1.0.0", user: { name: "Mr. Host" } });
        client = new Client({ applicationProtocolVersion: "1.0.0", user: { name: "Mr. Client" } });
        const hostOpenResult = await host.open();
        hostPeerId = hostOpenResult.peerId;
        const clientOpenResult = await client.open(hostPeerId);
        clientPeerId = clientOpenResult.peerId;
    });

    it("has sent the expected messages", () => {
        expect(getHistory()).toEqual([
            {
                from: clientPeerId,
                to: hostPeerId,
                data: {
                    messageType: ClientMessageType.HELLO,
                    applicationProtocolVersion: "1.0.0",
                    protocolVersion: libraryVersion,
                    user: client.ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerId,
                data: {
                    messageType: HostMessageType.WELCOME,
                    users: [
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: host.ownUser,
                        }
                    ]
                },
            },
            {
                from: hostPeerId,
                to: clientPeerId,
                data: {
                    messageType: HostMessageType.USER_CONNECTED,
                    user: client.ownUser,
                },
            },
        ]);
    });

    it("has both users on host side", () => {
        expect(host.users.all).toEqual([
            {
                lastPingDate: expect.any(Number),
                lostPingMessages: 0,
                roundTripTime: undefined,
                user: {
                    id: host.userId,
                    name: "Mr. Host",
                },
            },
            {
                lastPingDate: expect.any(Number),
                lostPingMessages: 0,
                roundTripTime: undefined,
                user: {
                    id: client.userId,
                    name: "Mr. Client",
                },
            },
        ]);
    });
});
