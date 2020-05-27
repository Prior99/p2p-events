jest.mock("peerjs");
import { ClientPacketType, HostPacketType, MessageFactory, SentMessageHandle, PingInfo } from "../src";
import { resetHistory, getHistory } from "./packet-history";
import {
    mockHistoryPacket,
    mockUserInfo,
    MockMessageType,
    mockUserList,
    mockVersion,
    mockUserInfoList,
    mockPingInfoList,
    MockPayload,
    scenarioFourPeers,
    ScenarioFourPeers,
} from "./utils";

describe("Four peers", () => {
    let scenario: ScenarioFourPeers;

    beforeEach(async () => {
        scenario = await scenarioFourPeers();
    });

    it("has sent the expected messages", () => {
        expect(getHistory()).toEqual([
            mockHistoryPacket(scenario.clientPeerIds[0], scenario.hostPeerId, ClientPacketType.HELLO, {
                versions: mockVersion(),
                user: scenario.clients[0].user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.WELCOME, {
                users: mockUserInfoList(mockUserInfo({ user: scenario.host.user })),
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[0].user,
            }),
            mockHistoryPacket(scenario.clientPeerIds[1], scenario.hostPeerId, ClientPacketType.HELLO, {
                versions: mockVersion(),
                user: scenario.clients[1].user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.WELCOME, {
                users: mockUserInfoList(mockUserInfo({ user: scenario.host.user }), mockUserInfo({ user: scenario.clients[0].user })),
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[1].user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[1].user,
            }),
            mockHistoryPacket(scenario.clientPeerIds[2], scenario.hostPeerId, ClientPacketType.HELLO, {
                versions: mockVersion(),
                user: scenario.clients[2].user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.WELCOME, {
                users: mockUserInfoList(
                    mockUserInfo({ user: scenario.host.user }),
                    mockUserInfo({ user: scenario.clients[0].user }),
                    mockUserInfo({ user: scenario.clients[1].user }),
                ),
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[2].user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[2].user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[2].user,
            }),
        ]);
    });

    it("all peers know of all users", () => {
        [scenario.host, ...scenario.clients].forEach((peer) =>
            expect(peer.users).toEqual(
                mockUserList(
                    {
                        id: scenario.host.userId,
                        name: "Mr. Host",
                    },
                    {
                        id: scenario.clients[0].userId,
                        name: "Mr. Client #0",
                    },
                    {
                        id: scenario.clients[1].userId,
                        name: "Mr. Client #1",
                    },
                    {
                        id: scenario.clients[2].userId,
                        name: "Mr. Client #2",
                    },
                ),
            ),
        );
    });

    describe("with a registered message", () => {
        let hostMessageFactory: MessageFactory<MockMessageType, MockPayload>;
        let clientMessageFactories: MessageFactory<MockMessageType, MockPayload>[];
        let spyMessageHost: jest.MockedFunction<any>;
        let spyMessageClients: jest.MockedFunction<any>[];

        beforeEach(async () => {
            spyMessageClients = scenario.clients.map(() => jest.fn());
            spyMessageHost = jest.fn();
            resetHistory();
            hostMessageFactory = scenario.host.message<MockPayload>(MockMessageType.MOCK_MESSAGE);
            clientMessageFactories = scenario.clients.map((client) => client.message<MockPayload>(MockMessageType.MOCK_MESSAGE));
            hostMessageFactory.subscribe(spyMessageHost);
            clientMessageFactories.forEach((factory, index) => factory.subscribe(spyMessageClients[index]));
        });

        describe("scenario.host sending the message to scenario.clients", () => {
            let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

            beforeEach(async () => {
                sendResult = hostMessageFactory.send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the scenario.host", () =>
                expect(spyMessageHost).toHaveBeenCalledWith({ test: "something" }, scenario.host.userId, expect.any(Date)));

            it("called the listeners on the scenario.clients", () =>
                spyMessageClients.forEach((spy) =>
                    expect(spy).toHaveBeenCalledWith({ test: "something" }, scenario.host.userId, expect.any(Date)),
                ));
        });

        describe("client sending the message to specific client", () => {
            let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

            beforeEach(async () => {
                sendResult = clientMessageFactories[0].send({ test: "something" }, scenario.clients[1].userId);
                await sendResult.waitForAll();
            });

            it("didn't the listeners that weren't the target", () =>
                [spyMessageHost, spyMessageClients[0], spyMessageClients[2]].forEach((spy) =>
                    expect(spy).not.toHaveBeenCalled(),
                ));

            it("called the listeners on the target client", () =>
                [spyMessageClients[1]].forEach((spy) =>
                    expect(spy).toHaveBeenCalledWith({ test: "something" }, scenario.clients[0].userId, expect.any(Date)),
                ));

            it("has sent the expected messages", () => {
                expect(getHistory()).toEqual([
                    mockHistoryPacket(scenario.clientPeerIds[0], scenario.hostPeerId, ClientPacketType.MESSAGE, {
                        message: {
                            createdDate: expect.any(Number),
                            messageType: MockMessageType.MOCK_MESSAGE,
                            originUserId: scenario.clients[0].userId,
                            serialId: sendResult.message.serialId,
                            payload: {
                                test: "something",
                            },
                        },
                        targets: [scenario.clients[1].userId],
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.ACKNOWLEDGED_BY_HOST, {
                        serialId: sendResult.message.serialId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.RELAYED_MESSAGE, {
                        message: {
                            createdDate: expect.any(Number),
                            messageType: MockMessageType.MOCK_MESSAGE,
                            originUserId: scenario.clients[0].userId,
                            serialId: sendResult.message.serialId,
                            payload: {
                                test: "something",
                            },
                        },
                    }),
                    mockHistoryPacket(scenario.clientPeerIds[1], scenario.hostPeerId, ClientPacketType.ACKNOWLEDGE, {
                        serialId: sendResult.message.serialId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.ACKNOWLEDGED_BY_ALL, {
                        serialId: sendResult.message.serialId,
                    }),
                ]);
            });
        });

        describe("client sending the message to scenario.host", () => {
            let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

            beforeEach(async () => {
                sendResult = clientMessageFactories[0].send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the scenario.host", () =>
                expect(spyMessageHost).toHaveBeenCalledWith(
                    { test: "something" },
                    scenario.clients[0].userId,
                    expect.any(Date),
                ));

            it("called the listeners on the scenario.clients", () =>
                spyMessageClients.forEach((spy) =>
                    expect(spy).toHaveBeenCalledWith({ test: "something" }, scenario.clients[0].userId, expect.any(Date)),
                ));

            it("has sent the expected messages", () => {
                expect(getHistory()).toEqual([
                    mockHistoryPacket(scenario.clientPeerIds[0], scenario.hostPeerId, ClientPacketType.MESSAGE, {
                        message: {
                            createdDate: expect.any(Number),
                            messageType: MockMessageType.MOCK_MESSAGE,
                            originUserId: scenario.clients[0].userId,
                            serialId: sendResult.message.serialId,
                            payload: {
                                test: "something",
                            },
                        },
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.ACKNOWLEDGED_BY_HOST, {
                        serialId: sendResult.message.serialId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.RELAYED_MESSAGE, {
                        message: {
                            createdDate: expect.any(Number),
                            messageType: MockMessageType.MOCK_MESSAGE,
                            originUserId: scenario.clients[0].userId,
                            serialId: sendResult.message.serialId,
                            payload: {
                                test: "something",
                            },
                        },
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.RELAYED_MESSAGE, {
                        message: {
                            createdDate: expect.any(Number),
                            messageType: MockMessageType.MOCK_MESSAGE,
                            originUserId: scenario.clients[0].userId,
                            serialId: sendResult.message.serialId,
                            payload: {
                                test: "something",
                            },
                        },
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.RELAYED_MESSAGE, {
                        message: {
                            createdDate: expect.any(Number),
                            messageType: MockMessageType.MOCK_MESSAGE,
                            originUserId: scenario.clients[0].userId,
                            serialId: sendResult.message.serialId,
                            payload: {
                                test: "something",
                            },
                        },
                    }),
                    mockHistoryPacket(scenario.clientPeerIds[0], scenario.hostPeerId, ClientPacketType.ACKNOWLEDGE, {
                        serialId: sendResult.message.serialId,
                    }),
                    mockHistoryPacket(scenario.clientPeerIds[1], scenario.hostPeerId, ClientPacketType.ACKNOWLEDGE, {
                        serialId: sendResult.message.serialId,
                    }),
                    mockHistoryPacket(scenario.clientPeerIds[2], scenario.hostPeerId, ClientPacketType.ACKNOWLEDGE, {
                        serialId: sendResult.message.serialId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.ACKNOWLEDGED_BY_ALL, {
                        serialId: sendResult.message.serialId,
                    }),
                ]);
            });
        });
    });

    describe("with a client being broken", () => {
        let pingResult: any;
        let spyDisconnect: jest.MockedFunction<any>;

        beforeEach(async () => {
            spyDisconnect = jest.fn();
            scenario.clients[0].on("userdisconnect", spyDisconnect);
            (scenario.clients[1] as any).handleHostPacket = () => undefined;
            try {
                await scenario.host.ping();
            } catch (err) {
                pingResult = err;
            }
            await new Promise((resolve) => setTimeout(resolve));
        });

        it("fired 'userdisconnect'", () => expect(spyDisconnect).toHaveBeenCalledWith(scenario.clients[1].userId));

        it("rejects the ping", () => expect(pingResult).toEqual(expect.any(Error)));

        it("all peers removed the user", () => {
            [scenario.host, scenario.clients[0], scenario.clients[2]].forEach((peer) =>
                expect(peer.users).toEqual(
                    mockUserList(
                        {
                            id: scenario.host.userId,
                            name: "Mr. Host",
                        },
                        {
                            id: scenario.clients[0].userId,
                            name: "Mr. Client #0",
                        },
                        {
                            id: scenario.clients[2].userId,
                            name: "Mr. Client #2",
                        },
                    ),
                ),
            );
        });
    });

    describe("ping", () => {
        let spyDate: jest.SpiedFunction<any>;
        const now = 1590160273660;
        let pingInfos: PingInfo[];

        beforeEach(async () => {
            pingInfos = mockPingInfoList(
                {
                    userId: scenario.host.userId,
                    roundTripTime: 0,
                    lastPingDate: now,
                },
                {
                    userId: scenario.clients[0].userId,
                    roundTripTime: 0,
                    lastPingDate: now,
                },
                {
                    userId: scenario.clients[1].userId,
                    roundTripTime: 0,
                    lastPingDate: now,
                },
                {
                    userId: scenario.clients[2].userId,
                    roundTripTime: 0,
                    lastPingDate: now,
                },
            );
            resetHistory();
            spyDate = jest.spyOn(Date, "now").mockImplementation(() => now);
            await scenario.host.ping();
            await new Promise((resolve) => setTimeout(resolve));
        });

        afterEach(() => spyDate.mockRestore());

        it("has sent the expected messages", () => {
            expect(getHistory()).toEqual([
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.PING, {
                    initiationDate: now,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.PING, {
                    initiationDate: now,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.PING, {
                    initiationDate: now,
                }),
                mockHistoryPacket(scenario.clientPeerIds[0], scenario.hostPeerId, ClientPacketType.PONG, {
                    initiationDate: now,
                }),
                mockHistoryPacket(scenario.clientPeerIds[1], scenario.hostPeerId, ClientPacketType.PONG, {
                    initiationDate: now,
                }),
                mockHistoryPacket(scenario.clientPeerIds[2], scenario.hostPeerId, ClientPacketType.PONG, {
                    initiationDate: now,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.PING_INFO, {
                    pingInfos,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.PING_INFO, {
                    pingInfos,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.PING_INFO, {
                    pingInfos,
                }),
            ]);
        });

        it("has the ping infos available in all peers", () => {
            [scenario.host, ...scenario.clients].forEach((peer) =>
                expect(
                    Array.from(peer.pingInfos.entries()).map(([userId, { lastPingDate, roundTripTime }]) => ({
                        lastPingDate,
                        roundTripTime,
                        userId: userId,
                    })),
                ).toEqual(pingInfos),
            );
        });
    });
});
