import { scenarioSimple, mockHistoryPacket, mockUserList, ScenarioSimple } from "./utils";
import { resetHistory, getHistory } from "./packet-history";
import { HostPacketType, ClientPacketType } from "../src";

describe("Updating the user", () => {
    let scenario: ScenarioSimple;
    let spyUserUpdate: jest.MockedFunction<any>;
    let spyUserUpdateRemoved: jest.MockedFunction<any>;

    beforeEach(async () => {
        scenario = await scenarioSimple();
        spyUserUpdate = jest.fn();
        spyUserUpdateRemoved = jest.fn();
        scenario.host.on("userupdate", spyUserUpdate);
        scenario.host.on("userupdate", spyUserUpdateRemoved);
        scenario.host.removeEventListener("userupdate", spyUserUpdateRemoved);
        resetHistory();
        await scenario.client.updateUser({ name: "Mr. Newname" });
    });

    it("fires the event", () =>
        expect(spyUserUpdate).toHaveBeenCalledWith({ id: scenario.client.userId, name: "Mr. Newname" }));

    it("doesn't call removed event listener", () => expect(spyUserUpdateRemoved).not.toHaveBeenCalled());

    it("has sent the expected Packets", () => {
        expect(getHistory()).toEqual([
            mockHistoryPacket(scenario.clientPeerId, scenario.hostPeerId, ClientPacketType.UPDATE_USER, {
                user: {
                    name: "Mr. Newname",
                },
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerId, HostPacketType.UPDATE_USER, {
                user: {
                    id: scenario.client.userId,
                    name: "Mr. Newname",
                },
            }),
        ]);
    });

    it("updates the user", () => {
        [scenario.client, scenario.host].forEach((peer) =>
            expect(peer.users).toEqual(
                mockUserList(
                    {
                        id: scenario.host.userId,
                        name: "Mr. Host",
                    },
                    {
                        id: scenario.client.userId,
                        name: "Mr. Newname",
                    },
                ),
            ),
        );
    });
});
