import { ClientPacketType, HostPacketType, MessageFactory, SentMessageHandle } from "../src";
import { resetHistory, getHistory } from "./packet-history";
import { mockHistoryPacket, MockMessageType, MockPayload, ScenarioFourPeers, scenarioFourPeers } from "./utils";

describe("Registered message four peers", () => {
    let hostMessageFactory: MessageFactory<MockMessageType, MockPayload>;
    let clientMessageFactories: MessageFactory<MockMessageType, MockPayload>[];
    let spyMessageHost: jest.MockedFunction<any>;
    let spyMessageClients: jest.MockedFunction<any>[];
    let scenario: ScenarioFourPeers;

    beforeEach(async () => {
        scenario = await scenarioFourPeers();
        spyMessageClients = scenario.clients.map(() => jest.fn());
        spyMessageHost = jest.fn();
        resetHistory();
        hostMessageFactory = scenario.host.message<MockPayload>(MockMessageType.MOCK_MESSAGE);
        clientMessageFactories = scenario.clients.map((client) =>
            client.message<MockPayload>(MockMessageType.MOCK_MESSAGE),
        );
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

    describe("client sending the message to host", () => {
        let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

        beforeEach(async () => {
            sendResult = clientMessageFactories[0].send({ test: "something" });
            await sendResult.waitForAll();
        });

        it("called the listener on the host", () =>
            expect(spyMessageHost).toHaveBeenCalledWith(
                { test: "something" },
                scenario.clients[0].userId,
                expect.any(Date),
            ));

        it("called the listeners on the clients", () =>
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
