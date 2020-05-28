import { ScenarioFourPeers, mockUserList, scenarioFourPeers } from "./utils";

describe("Broken client with four peers", () => {
    let spyDisconnect: jest.MockedFunction<any>;
    let scenario: ScenarioFourPeers;

    beforeEach(async () => {
        scenario = await scenarioFourPeers();
        spyDisconnect = jest.fn();
        scenario.clients[0].on("userdisconnect", spyDisconnect);
        (scenario.clients[1] as any).handleHostPacket = () => undefined;
        await scenario.host.ping();
        await new Promise((resolve) => setTimeout(resolve));
    });

    it("fired 'userdisconnect'", () => expect(spyDisconnect).toHaveBeenCalledWith(scenario.clients[1].userId));

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
