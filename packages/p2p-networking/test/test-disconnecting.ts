import { ScenarioSimple, scenarioSimple, mockHistoryPacket } from "./utils";
import { resetHistory, getHistory } from "./packet-history";
import { ClientPacketType, HostPacketType } from "../src";

describe("Disconnecting", () => {
    let spyUserDisconnect: jest.MockedFunction<any>;
    let scenario: ScenarioSimple;

    beforeEach(async (done) => {
        scenario = await scenarioSimple();
        spyUserDisconnect = jest.fn(() => done());
        scenario.host.on("userdisconnect", spyUserDisconnect);
        resetHistory();
        scenario.client.close();
    });

    it("fires the event", () => expect(spyUserDisconnect).toHaveBeenCalledWith(scenario.client.userId));

    it("has sent the expected Packets", () => {
        expect(getHistory()).toEqual([
            mockHistoryPacket(scenario.clientPeerId, scenario.hostPeerId, ClientPacketType.DISCONNECT, {}),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerId, HostPacketType.USER_DISCONNECTED, {
                userId: scenario.client.userId,
            }),
        ]);
    });

    it("removed the user from host's users", () => {
        expect(scenario.host.users).toEqual([
            {
                id: scenario.host.userId,
                name: "Mr. Host",
            },
        ]);
    });
});
