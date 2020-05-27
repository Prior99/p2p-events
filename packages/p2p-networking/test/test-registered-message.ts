import { scenarioSimple, mockHistoryPacket, ScenarioSimple, MockMessageType, MockPayload } from "./utils";
import { resetHistory, getHistory } from "./packet-history";
import { HostPacketType, ClientPacketType, MessageFactory, SentMessageHandle } from "../src";

describe("Registered message", () => {
    let scenario: ScenarioSimple;
    let hostMessage: MessageFactory<MockMessageType, MockPayload>;
    let clientMessage: MessageFactory<MockMessageType, MockPayload>;
    let spyMessageHost: jest.MockedFunction<any>;
    let spyMessageClient: jest.MockedFunction<any>;

    beforeEach(async () => {
        scenario = await scenarioSimple();
        spyMessageClient = jest.fn();
        spyMessageHost = jest.fn();
        resetHistory();
        hostMessage = scenario.host.message<MockPayload>(MockMessageType.MOCK_MESSAGE);
        clientMessage = scenario.client.message<MockPayload>(MockMessageType.MOCK_MESSAGE);
        hostMessage.subscribe(spyMessageHost);
        clientMessage.subscribe(spyMessageClient);
    });

    describe("with the client ignoring the serial from itself", () => {
        let hostAwaited: boolean;
        let allAwaited: boolean;
        let hostError: Error;
        let allError: Error;

        beforeEach(async () => {
            hostAwaited = false;
            allAwaited = false;
            const message = clientMessage.send({ test: "some" });
            scenario.client.ignoreSerialId(message.message.serialId);
            await Promise.race([
                message
                    .waitForHost()
                    .then(() => (hostAwaited = true))
                    .catch((err) => (hostError = err)),
                new Promise((resolve) => setTimeout(resolve, 1)),
            ]);
            await Promise.race([
                message
                    .waitForAll()
                    .then(() => (allAwaited = true))
                    .catch((err) => (allError = err)),
                new Promise((resolve) => setTimeout(resolve, 1)),
            ]);
        });

        it("doesn't resolve for host", () => expect(hostAwaited).toBe(false));
        it("doesn't resolve for all", () => expect(allAwaited).toBe(false));
        it("has error for host", () => expect(hostError).toEqual(expect.any(Error)));
        it("has error for all", () => expect(allError).toEqual(expect.any(Error)));
    });

    describe("with the client ignoring the serial from the host", () => {
        beforeEach(async () => {
            const message = hostMessage.send({ test: "some" });
            scenario.client.ignoreSerialId(message.message.serialId);
            await message.waitForHost();
        });

        it("doesn't call the subscription", () => expect(spyMessageClient).not.toHaveBeenCalled());
    });

    describe("with the client being broken", () => {
        beforeEach(() => {
            (scenario.client as any).handleHostPacket = () => undefined;
        });

        describe("with the host being broken", () => {
            beforeEach(() => {
                (scenario.host as any).handleHostPacket = () => undefined;
            });

            describe("host sending the message to client", () => {
                let sendResult: SentMessageHandle<MockMessageType, MockPayload>;
                let promiseWaitForHost: Promise<any>;
                let promiseWaitForAll: Promise<any>;

                beforeEach(async () => {
                    sendResult = hostMessage.send({ test: "something" });
                    promiseWaitForAll = sendResult.waitForAll();
                    // See https://github.com/facebook/jest/issues/6028#issuecomment-567669082
                    promiseWaitForAll.catch(() => undefined);
                    promiseWaitForHost = sendResult.waitForHost();
                    // See https://github.com/facebook/jest/issues/6028#issuecomment-567669082
                    promiseWaitForHost.catch(() => undefined);
                    await new Promise((resolve) => setTimeout(resolve, 20));
                });

                it("rejected waitForHost()", () => expect(promiseWaitForHost).rejects.toThrow(expect.any(Error)));

                it("rejected waitForAll()", () => expect(promiseWaitForAll).rejects.toThrow(expect.any(Error)));
            });
        });

        describe("host sending the message to client", () => {
            let sendResult: SentMessageHandle<MockMessageType, MockPayload>;
            let promiseWaitForHost: Promise<any>;
            let promiseWaitForAll: Promise<any>;

            beforeEach(async () => {
                sendResult = hostMessage.send({ test: "something" });
                promiseWaitForAll = sendResult.waitForAll();
                // See https://github.com/facebook/jest/issues/6028#issuecomment-567669082
                promiseWaitForAll.catch(() => undefined);
                promiseWaitForHost = sendResult.waitForHost();
                await new Promise((resolve) => setTimeout(resolve, 20));
            });

            it("resolved waitForHost()", () => expect(promiseWaitForHost).resolves.toBeUndefined());

            it("rejected waitForAll()", () => expect(promiseWaitForAll).rejects.toThrow(expect.any(Error)));
        });
    });

    describe("host sending the message to client", () => {
        let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

        beforeEach(async () => {
            sendResult = hostMessage.send({ test: "something" });
            await sendResult.waitForAll();
        });

        it("called the listener on the scenario.host", () =>
            expect(spyMessageHost).toHaveBeenCalledWith({ test: "something" }, scenario.host.userId, expect.any(Date)));

        it("called the listener on the scenario.client", () =>
            expect(spyMessageClient).toHaveBeenCalledWith(
                { test: "something" },
                scenario.host.userId,
                expect.any(Date),
            ));
    });

    describe("client sending the message to host", () => {
        let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

        beforeEach(async () => {
            resetHistory();
            sendResult = clientMessage.send({ test: "something" });
            await sendResult.waitForAll();
        });

        it("called the listener on the host", () =>
            expect(spyMessageHost).toHaveBeenCalledWith(
                { test: "something" },
                scenario.client.userId,
                expect.any(Date),
            ));

        it("called the listener on the client", () =>
            expect(spyMessageClient).toHaveBeenCalledWith(
                { test: "something" },
                scenario.client.userId,
                expect.any(Date),
            ));

        it("has sent the expected packets", () => {
            expect(getHistory()).toEqual([
                mockHistoryPacket(scenario.clientPeerId, scenario.hostPeerId, ClientPacketType.MESSAGE, {
                    message: {
                        createdDate: expect.any(Number),
                        messageType: MockMessageType.MOCK_MESSAGE,
                        originUserId: scenario.client.userId,
                        serialId: sendResult.message.serialId,
                        payload: {
                            test: "something",
                        },
                    },
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerId, HostPacketType.ACKNOWLEDGED_BY_HOST, {
                    serialId: sendResult.message.serialId,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerId, HostPacketType.RELAYED_MESSAGE, {
                    message: {
                        createdDate: expect.any(Number),
                        messageType: MockMessageType.MOCK_MESSAGE,
                        originUserId: scenario.client.userId,
                        serialId: sendResult.message.serialId,
                        payload: {
                            test: "something",
                        },
                    },
                }),
                mockHistoryPacket(scenario.clientPeerId, scenario.hostPeerId, ClientPacketType.ACKNOWLEDGE, {
                    serialId: sendResult.message.serialId,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerId, HostPacketType.ACKNOWLEDGED_BY_ALL, {
                    serialId: sendResult.message.serialId,
                }),
            ]);
        });
    });
});
