import { ClientPacketType, HostPacketType } from "../src";
import { getHistory } from "./packet-history";
import {
    mockHistoryPacket,
    mockUserInfo,
    mockUserList,
    mockVersion,
    mockUserInfoList,
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
                users: mockUserInfoList(
                    mockUserInfo({ user: scenario.host.user }),
                    mockUserInfo({ user: scenario.clients[0].user }),
                ),
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
});
