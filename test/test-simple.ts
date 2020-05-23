jest.mock("peerjs");
import { Host, Client, ClientPacketType, HostPacketType, MessageFactory, SentMessageHandle } from "../src";
import { resetHistory, getHistory } from "./packet-history";
import { libraryVersion } from "../generated/version";

interface MockUser {
    id: string;
    name: string;
}

const enum MockEvents {
    MOCK_EVENT = "mock event",
}

interface MockEventPayload {
    test: string;
}

describe("Simple", () => {
    let host: Host<MockUser, MockEvents>;
    let client: Client<MockUser, MockEvents>;
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

    it("has sent the expected Packets", () => {
        expect(getHistory()).toEqual([
            {
                from: clientPeerId,
                to: hostPeerId,
                data: {
                    packetType: ClientPacketType.HELLO,
                    applicationProtocolVersion: "1.0.0",
                    protocolVersion: libraryVersion,
                    user: client.ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerId,
                data: {
                    packetType: HostPacketType.WELCOME,
                    users: [
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: host.ownUser,
                        },
                    ],
                },
            },
            {
                from: hostPeerId,
                to: clientPeerId,
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: client.ownUser,
                },
            },
        ]);
    });

    it("has both users on host side", () => {
        const expected = [
            {
                id: host.userId,
                name: "Mr. Host",
            },
            {
                id: client.userId,
                name: "Mr. Client",
            },
        ].sort((a, b) => a.id.localeCompare(b.id));
        expect(host.users).toEqual(expected);
    });

    describe("with a registered event", () => {
        let hostEvent: MessageFactory<MockEventPayload>;
        let clientEvent: MessageFactory<MockEventPayload>;
        let spyEventHost: jest.MockedFunction<any>;
        let spyEventClient: jest.MockedFunction<any>;

        beforeEach(async () => {
            spyEventClient = jest.fn();
            spyEventHost = jest.fn();
            resetHistory();
            hostEvent = host.message<MockEventPayload>(MockEvents.MOCK_EVENT);
            clientEvent = client.message<MockEventPayload>(MockEvents.MOCK_EVENT);
            hostEvent.subscribe(spyEventHost);
            clientEvent.subscribe(spyEventClient);
        });

        describe("host sending the event to client", () => {
            let sendResult: SentMessageHandle<MockEventPayload>;

            beforeEach(async () => {
                sendResult = hostEvent.send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the host", () =>
                expect(spyEventHost).toHaveBeenCalledWith({ test: "something" }, host.userId, expect.any(Date)));

            it("called the listener on the client", () =>
                expect(spyEventClient).toHaveBeenCalledWith({ test: "something" }, host.userId, expect.any(Date)));
        });

        describe("client sending the event to host", () => {
            let sendResult: SentMessageHandle<MockEventPayload>;

            beforeEach(async () => {
                sendResult = clientEvent.send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the host", () =>
                expect(spyEventHost).toHaveBeenCalledWith({ test: "something" }, client.userId, expect.any(Date)));

            it("called the listener on the client", () =>
                expect(spyEventClient).toHaveBeenCalledWith({ test: "something" }, client.userId, expect.any(Date)));

            it("has sent the expected Packets", () => {
                expect(getHistory()).toEqual([
                    {
                        from: clientPeerId,
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockEvents.MOCK_EVENT,
                                originUserId: client.userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerId,
                        data: {
                            packetType: HostPacketType.ACKNOWLEDGED_BY_HOST,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerId,
                        data: {
                            packetType: HostPacketType.RELAYED_MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockEvents.MOCK_EVENT,
                                originUserId: client.userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: clientPeerId,
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.ACKNOWLEDGE,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerId,
                        data: {
                            packetType: HostPacketType.ACKNOWLEDGED_BY_ALL,
                            serialId: sendResult.message.serialId,
                        },
                    },
                ]);
            });
        });
    });
});
