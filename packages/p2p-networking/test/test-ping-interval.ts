import { ScenarioSimple, scenarioSimple } from "./utils";
import { resetHistory } from "./packet-history";

describe("Ping interval", () => {
    let spyPing: jest.MockedFunction<any>;
    let scenario: ScenarioSimple;

    beforeEach(async (done) => {
        spyPing = jest.fn(() => {
            scenario.host.stopPing();
            done();
        });
        scenario = await scenarioSimple(true, { pingInterval: 0.001 });
        resetHistory();
        scenario.client.once("pinginfo", spyPing);
    });

    it("calls the ping handler", () => expect(spyPing).toBeCalled());
});
