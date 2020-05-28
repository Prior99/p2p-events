import { ScenarioSimple, scenarioSimple, MockMessageType } from "./utils";
import { ErrorReason } from "../src";

describe("Closed connection", () => {
    let scenario: ScenarioSimple;

    beforeEach(async () => (scenario = await scenarioSimple(false)));

    it("host has no connection id", () => expect(scenario.host.hostConnectionId).toBe(undefined));

    it("client is not client", () => expect(scenario.client.isClient).toBe(false));

    it("client is not host", () => expect(scenario.client.isHost).toBe(false));

    it("client is not connected", () => expect(scenario.client.isConnected).toBe(false));

    it("client is not connecting", () => expect(scenario.client.isConnecting).toBe(false));

    it("client is disconnected", () => expect(scenario.client.isDisconnected).toBe(true));

    it("can't close peer that isn't open", () => expect(() => scenario.host.close()).toThrowError());

    it("can stop pinging with no effect", () => expect(() => scenario.host.stopPing()).not.toThrowError());

    describe("sending", () => {
        let spyError: jest.MockedFunction<any>;
        let rejectResult: any;

        beforeEach(async () => {
            spyError = jest.fn();
            scenario.client.once("error", spyError);
            try {
                await scenario.client.message(MockMessageType.MOCK_MESSAGE).send({ test: "test" }).waitForHost();
            } catch (err) {
                rejectResult = err;
            }
        });

        it("rejects", () => expect(rejectResult).toEqual(expect.any(Error)));

        it("called the error handler", () =>
            expect(spyError).toHaveBeenCalledWith(expect.any(Error), ErrorReason.OTHER));
    });
});
