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

describe("Four peers", () => {
    let host: Host<MockUser, MockEvents>;
    let clients: Client<MockUser, MockEvents>[];
    let hostPeerId: string;
    let clientPeerIds: string[];

    beforeEach(async () => {
        resetHistory();
        host = new Host({ applicationProtocolVersion: "1.0.0", user: { name: "Mr. Host" } });
        clients = Array.from({ length: 3 }).map(
            (_, index) => new Client({ applicationProtocolVersion: "1.0.0", user: { name: `Mr. Client #${index}` } }),
        );
        const hostOpenResult = await host.open();
        hostPeerId = hostOpenResult.peerId;
        clientPeerIds = [];
        await Promise.all(
            clients.map(async (client) => {
                const clientOpenResult = await client.open(hostPeerId);
                clientPeerIds.push(clientOpenResult.peerId);
            }),
        );
    });

    it("has sent the expected messages", () => {
        expect(getHistory()).toEqual([
            {
                from: clientPeerIds[0],
                to: hostPeerId,
                data: {
                    packetType: ClientPacketType.HELLO,
                    applicationProtocolVersion: "1.0.0",
                    protocolVersion: libraryVersion,
                    user: clients[0].ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[0],
                data: {
                    packetType: HostPacketType.WELCOME,
                    users: [
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: host.ownUser,
                        },
                    ].sort((a, b) => a.user.id.localeCompare(b.user.id)),
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[0],
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: clients[0].ownUser,
                },
            },
            {
                from: clientPeerIds[1],
                to: hostPeerId,
                data: {
                    packetType: ClientPacketType.HELLO,
                    applicationProtocolVersion: "1.0.0",
                    protocolVersion: libraryVersion,
                    user: clients[1].ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[1],
                data: {
                    packetType: HostPacketType.WELCOME,
                    users: [
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: host.ownUser,
                        },
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: clients[0].ownUser,
                        },
                    ].sort((a, b) => a.user.id.localeCompare(b.user.id)),
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[0],
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: clients[1].ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[1],
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: clients[1].ownUser,
                },
            },
            {
                from: clientPeerIds[2],
                to: hostPeerId,
                data: {
                    packetType: ClientPacketType.HELLO,
                    applicationProtocolVersion: "1.0.0",
                    protocolVersion: libraryVersion,
                    user: clients[2].ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[2],
                data: {
                    packetType: HostPacketType.WELCOME,
                    users: [
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: host.ownUser,
                        },
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: clients[0].ownUser,
                        },
                        {
                            lastPingDate: expect.any(Number),
                            lostPingMessages: 0,
                            roundTripTime: undefined,
                            user: clients[1].ownUser,
                        },
                    ].sort((a, b) => a.user.id.localeCompare(b.user.id)),
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[0],
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: clients[2].ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[1],
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: clients[2].ownUser,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerIds[2],
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: clients[2].ownUser,
                },
            },
        ]);
    });

    it("all peers know of all users", () => {
        const expected = [
            {
                id: host.userId,
                name: "Mr. Host",
            },
            {
                id: clients[0].userId,
                name: "Mr. Client #0",
            },
            {
                id: clients[1].userId,
                name: "Mr. Client #1",
            },
            {
                id: clients[2].userId,
                name: "Mr. Client #2",
            },
        ].sort((a, b) => a.id.localeCompare(b.id));
        [host, ...clients].forEach((peer) => expect(peer.users).toEqual(expected));
    });

    describe("with a registered event", () => {
        let hostEvent: MessageFactory<MockEventPayload>;
        let clientEvents: MessageFactory<MockEventPayload>[];
        let spyEventHost: jest.MockedFunction<any>;
        let spyEventClients: jest.MockedFunction<any>[];

        beforeEach(async () => {
            spyEventClients = clients.map(() => jest.fn());
            spyEventHost = jest.fn();
            resetHistory();
            hostEvent = host.message<MockEventPayload>(MockEvents.MOCK_EVENT);
            clientEvents = clients.map((client) => client.message<MockEventPayload>(MockEvents.MOCK_EVENT));
            hostEvent.subscribe(spyEventHost);
            clientEvents.forEach((event, index) => event.subscribe(spyEventClients[index]));
        });

        describe("host sending the event to clients", () => {
            let sendResult: SentMessageHandle<MockEventPayload>;

            beforeEach(async () => {
                sendResult = hostEvent.send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the host", () =>
                expect(spyEventHost).toHaveBeenCalledWith({ test: "something" }, host.userId, expect.any(Date)));

            it("called the listeners on the clients", () =>
                spyEventClients.forEach((spy) =>
                    expect(spy).toHaveBeenCalledWith({ test: "something" }, host.userId, expect.any(Date)),
                ));
        });

        describe("client sending the event to host", () => {
            let sendResult: SentMessageHandle<MockEventPayload>;

            beforeEach(async () => {
                sendResult = clientEvents[0].send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the host", () =>
                expect(spyEventHost).toHaveBeenCalledWith({ test: "something" }, clients[0].userId, expect.any(Date)));

            it("called the listeners on the clients", () =>
                spyEventClients.forEach((spy) =>
                    expect(spy).toHaveBeenCalledWith({ test: "something" }, clients[0].userId, expect.any(Date)),
                ));

            it("has sent the expected messages", () => {
                expect(getHistory()).toEqual([
                    {
                        from: clientPeerIds[0],
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockEvents.MOCK_EVENT,
                                originUserId: clients[0].userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerIds[0],
                        data: {
                            packetType: HostPacketType.ACKNOWLEDGED_BY_HOST,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerIds[0],
                        data: {
                            packetType: HostPacketType.RELAYED_MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockEvents.MOCK_EVENT,
                                originUserId: clients[0].userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: clientPeerIds[0],
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.ACKNOWLEDGE,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerIds[1],
                        data: {
                            packetType: HostPacketType.RELAYED_MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockEvents.MOCK_EVENT,
                                originUserId: clients[0].userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: clientPeerIds[1],
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.ACKNOWLEDGE,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerIds[2],
                        data: {
                            packetType: HostPacketType.RELAYED_MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockEvents.MOCK_EVENT,
                                originUserId: clients[0].userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: clientPeerIds[2],
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.ACKNOWLEDGE,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerIds[0],
                        data: {
                            packetType: HostPacketType.ACKNOWLEDGED_BY_ALL,
                            serialId: sendResult.message.serialId,
                        },
                    },
                ]);
            });
        });
    });

    describe("ping", () => {
        let spyDate: jest.SpiedFunction<any>;
        const now = 1590160273660;

        beforeEach(() => {
            resetHistory();
            spyDate = jest.spyOn(Date, "now").mockImplementation(() => now);
            host.ping();
        });

        afterEach(() => spyDate.mockRestore());

        it("has sent the expected messages", () => {
            expect(getHistory()).toEqual([
                {
                    from: hostPeerId,
                    to: clientPeerIds[0],
                    data: {
                        packetType: HostPacketType.PING,
                        initiationDate: now,
                    },
                },
                {
                    from: clientPeerIds[0],
                    to: hostPeerId,
                    data: {
                        packetType: ClientPacketType.PONG,
                        initiationDate: now,
                        sequenceNumber: 1,
                    },
                },
                {
                    from: hostPeerId,
                    to: clientPeerIds[1],
                    data: {
                        packetType: HostPacketType.PING,
                        initiationDate: now,
                    },
                },
                {
                    from: clientPeerIds[1],
                    to: hostPeerId,
                    data: {
                        packetType: ClientPacketType.PONG,
                        initiationDate: now,
                        sequenceNumber: 1,
                    },
                },
                {
                    from: hostPeerId,
                    to: clientPeerIds[2],
                    data: {
                        packetType: HostPacketType.PING,
                        initiationDate: now,
                    },
                },
                {
                    from: clientPeerIds[2],
                    to: hostPeerId,
                    data: {
                        packetType: ClientPacketType.PONG,
                        initiationDate: now,
                        sequenceNumber: 1,
                    },
                },
            ]);
        });

        describe("after publishing the ping info", () => {
            let pingInfos: any[];
            beforeEach(() => {
                resetHistory();
                host.informPing();
                pingInfos = [
                    {
                        userId: host.userId,
                        lastPingDate: now,
                        roundTripTime: 0,
                        lostPingMessages: 0,
                    },
                    {
                        userId: clients[0].userId,
                        lastPingDate: now,
                        roundTripTime: 0,
                        lostPingMessages: 0,
                    },
                    {
                        userId: clients[1].userId,
                        lastPingDate: now,
                        roundTripTime: 0,
                        lostPingMessages: 0,
                    },
                    {
                        userId: clients[2].userId,
                        lastPingDate: now,
                        roundTripTime: 0,
                        lostPingMessages: 0,
                    },
                ].sort((a, b) => a.userId.localeCompare(b.userId));
            });

            it("has the ping infos available in all peers", () => {
                [host, ...clients].forEach((peer) =>
                    expect(
                        Array.from(peer.pingInfos.entries()).map(
                            ([userId, { lastPingDate, lostPingMessages, roundTripTime }]) => ({
                                lastPingDate,
                                lostPingMessages,
                                roundTripTime,
                                userId: userId,
                            }),
                        ),
                    ).toEqual(pingInfos),
                );
            });

            it("has sent the expected messages", () => {
                expect(getHistory()).toEqual([
                    {
                        from: hostPeerId,
                        to: clientPeerIds[0],
                        data: {
                            packetType: HostPacketType.PING_INFO,
                            pingInfos,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerIds[1],
                        data: {
                            packetType: HostPacketType.PING_INFO,
                            pingInfos,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerIds[2],
                        data: {
                            packetType: HostPacketType.PING_INFO,
                            pingInfos,
                        },
                    },
                ]);
            });
        });
    });
});
