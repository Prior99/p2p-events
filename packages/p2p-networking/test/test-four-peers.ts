import { ClientPacketType, HostPacketType, Client } from "../src";
import { getHistory, resetHistory } from "./packet-history";
import {
    mockHistoryPacket,
    mockUserInfo,
    mockUserList,
    mockVersion,
    mockUserInfoList,
    scenarioFourPeers,
    ScenarioFourPeers,
    MockUser,
    MockMessageType,
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
                user: scenario.clients[0].user!,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.WELCOME, {
                users: mockUserInfoList(mockUserInfo({ user: scenario.host.user! })),
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[0].user!,
            }),
            mockHistoryPacket(scenario.clientPeerIds[1], scenario.hostPeerId, ClientPacketType.HELLO, {
                versions: mockVersion(),
                user: scenario.clients[1].user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.WELCOME, {
                users: mockUserInfoList(
                    mockUserInfo({ user: scenario.host.user! }),
                    mockUserInfo({ user: scenario.clients[0].user! }),
                ),
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[1].user!,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[1].user!,
            }),
            mockHistoryPacket(scenario.clientPeerIds[2], scenario.hostPeerId, ClientPacketType.HELLO, {
                versions: mockVersion(),
                user: scenario.clients[2].user!,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.WELCOME, {
                users: mockUserInfoList(
                    mockUserInfo({ user: scenario.host.user! }),
                    mockUserInfo({ user: scenario.clients[0].user! }),
                    mockUserInfo({ user: scenario.clients[1].user! }),
                ),
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[2].user!,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[2].user!,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.USER_CONNECTED, {
                user: scenario.clients[2].user!,
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

    describe("after kicking a client", () => {
        let connectedClients: Client<MockUser, MockMessageType>[];
        let kickedClient: Client<MockUser, MockMessageType>;
        let spyUserKicks: jest.MockedFunction<any>[];
        let spyUserDisconnecteds: jest.MockedFunction<any>[];

        beforeEach(async (done) => {
            resetHistory();
            spyUserKicks = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
            spyUserDisconnecteds = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
            kickedClient = scenario.clients[1];
            connectedClients = [scenario.clients[0], scenario.clients[2]];
            let emitCount = 0;
            [scenario.host, ...scenario.clients].forEach((peer, index) => {
                peer.on("userkick", spyUserKicks[index]);
                peer.on("userdisconnect", spyUserDisconnecteds[index]);
                peer.once("userdisconnect", () => {
                    emitCount++;
                    if (emitCount === 4) {
                        done();
                    }
                });
            });
            await scenario.host.kickUser(scenario.clients[1].userId);
        });

        it("has sent the expected Packets", () => {
            expect(getHistory()).toEqual([
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.KICK_USER, {
                    userId: kickedClient.userId,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.KICK_USER, {
                    userId: kickedClient.userId,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.KICK_USER, {
                    userId: kickedClient.userId,
                }),
            ]);
        });

        it("fires 'userkick'", () =>
            spyUserKicks.forEach((spy) => expect(spy).toHaveBeenCalledWith(kickedClient.userId)));

        it("fires 'userdisconnecteds'", () =>
            spyUserDisconnecteds.forEach((spy) => expect(spy).toHaveBeenCalledWith(kickedClient.userId)));

        it("doesn't know the user", () =>
            [scenario.host, ...scenario.clients].forEach((peer) =>
                expect(peer.users).toEqual(
                    mockUserList(scenario.host.user!, ...connectedClients.map((client) => client.user!)),
                ),
            ));

        it("doesn't know the user as disconnected", () =>
            [scenario.host, ...scenario.clients].forEach((peer) => expect(peer.disconnectedUsers).toEqual([])));
    });
});
