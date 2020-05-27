import { PingInfo, HostPacketType, ClientPacketType } from "../src";
import { mockPingInfoList, ScenarioFourPeers, scenarioFourPeers, mockHistoryPacket } from "./utils";
import { resetHistory, getHistory } from "./packet-history";

describe("Ping with four peers", () => {
    let scenario: ScenarioFourPeers;
    let spyDate: jest.SpiedFunction<any>;
    const now = 1590160273660;
    let pingInfos: PingInfo[];

    beforeEach(async () => {
        scenario = await scenarioFourPeers();
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
