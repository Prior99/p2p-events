import {
    ScenarioFourPeers,
    scenarioFourPeers,
    mockHistoryPacket,
    mockUserInfoList,
    mockUserInfo,
    mockVersion,
    mockUserList,
    MockUser,
    MockMessageType,
    mockPeerOptions,
} from "./utils";
import { resetHistory, getHistory } from "./packet-history";
import { ClientPacketType, HostPacketType, Client } from "../src";

describe("Disconnecting four peers", () => {
    let spyUserDisconnects: jest.MockedFunction<any>[];
    let scenario: ScenarioFourPeers;
    let connectedClients: Client<MockUser, MockMessageType>[];
    let disconnectedClient: Client<MockUser, MockMessageType>;
    let disconnectedPeerId: string;

    beforeEach(async (done) => {
        scenario = await scenarioFourPeers();
        spyUserDisconnects = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
        resetHistory();
        scenario.clients[1].close();
        disconnectedClient = scenario.clients[1];
        disconnectedPeerId = scenario.clientPeerIds[1];
        connectedClients = [scenario.clients[0], scenario.clients[2]];

        let eventReceivedCount = 0;
        [scenario.host, ...scenario.clients].forEach((peer, index) => {
            peer.on("userdisconnect", spyUserDisconnects[index]);
            peer.once("userdisconnect", () => {
                eventReceivedCount++;
                if (eventReceivedCount === 4) {
                    done();
                }
            });
        });
    });

    it("fires the event", () =>
        spyUserDisconnects.forEach((spy) => expect(spy).toHaveBeenCalledWith(disconnectedClient.userId)));

    it("has sent the expected Packets", () => {
        expect(getHistory()).toEqual([
            mockHistoryPacket(disconnectedPeerId, scenario.hostPeerId, ClientPacketType.DISCONNECT, {}),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_DISCONNECTED, {
                userId: disconnectedClient.userId,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.USER_DISCONNECTED, {
                userId: disconnectedClient.userId,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.USER_DISCONNECTED, {
                userId: disconnectedClient.userId,
            }),
        ]);
    });

    it("lists the user as disconnected", () =>
        [scenario.host, ...connectedClients].forEach((peer) =>
            expect(peer.disconnectedUsers).toEqual([disconnectedClient.user]),
        ));

    it("removed the user from users", () =>
        [scenario.host, ...scenario.clients].forEach((peer) =>
            expect(peer.users).toEqual(
                mockUserList(scenario.host.user, ...connectedClients.map((client) => client.user)),
            ),
        ));

    describe("after kicking the disconnected user", () => {
        let spyKicks: jest.MockedFunction<any>[];

        beforeEach(async (done) => {
            spyKicks = [jest.fn(), jest.fn(), jest.fn()];
            resetHistory();
            let eventReceivedCount = 0;
            [scenario.host, ...connectedClients].forEach((peer, index) => {
                peer.on("userkick", spyKicks[index]);
                peer.once("userkick", () => {
                    eventReceivedCount++;
                    if (eventReceivedCount === 3) {
                        done();
                    }
                });
            });
            await scenario.host.kickUser(disconnectedClient.userId);
        });

        it("has sent the expected Packets", () => {
            expect(getHistory()).toEqual([
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.KICK_USER, {
                    userId: disconnectedClient.userId,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[1], HostPacketType.KICK_USER, {
                    userId: disconnectedClient.userId,
                }),
                mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.KICK_USER, {
                    userId: disconnectedClient.userId,
                }),
            ]);
        });

        it("calls the 'userkick' event listeners", () =>
            spyKicks.forEach((spyKick) => expect(spyKick).toHaveBeenCalledWith(disconnectedClient.userId)));

        it("doesn't list the user as disconnected", () =>
            [scenario.host, ...connectedClients].forEach((peer) => expect(peer.disconnectedUsers).toEqual([])));

        it("removed the user from users", () =>
            [scenario.host, ...connectedClients].forEach((peer) =>
                expect(peer.users).toEqual(
                    mockUserList(scenario.host.user, ...connectedClients.map((client) => client.user)),
                ),
            ));
    });

    describe("reconnecting", () => {
        let spyReconnects: jest.MockedFunction<any>[];
        let spyUserConnects: jest.MockedFunction<any>[];
        let spyOpen: jest.MockedFunction<any>;
        let newPeerId: string;

        beforeEach(async () => {
            resetHistory();
            spyReconnects = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
            spyUserConnects = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
            spyOpen = jest.fn();
        });

        describe("with the same instance", () => {
            beforeEach(async (done) => {
                resetHistory();
                let eventReceivedCount = 0;
                [scenario.host, ...scenario.clients].forEach((peer, index) => {
                    peer.on("userreconnect", spyReconnects[index]);
                    peer.on("userconnect", spyUserConnects[index]);
                    peer.once("userreconnect", () => {
                        eventReceivedCount++;
                        if (eventReceivedCount === 4) {
                            done();
                        }
                    });
                });
                disconnectedClient.on("open", spyOpen);
                const result = await disconnectedClient.open(scenario.hostPeerId, disconnectedClient.userId);
                newPeerId = result.peerId;
            });

            it("has sent the expected Packets", () => {
                expect(getHistory()).toEqual([
                    mockHistoryPacket(newPeerId, scenario.hostPeerId, ClientPacketType.HELLO_AGAIN, {
                        userId: disconnectedClient.userId,
                        versions: mockVersion(),
                    }),
                    mockHistoryPacket(scenario.hostPeerId, newPeerId, HostPacketType.WELCOME_BACK, {
                        users: mockUserInfoList(
                            mockUserInfo({ user: scenario.host.user }),
                            mockUserInfo({ user: connectedClients[0].user }),
                            mockUserInfo({ user: disconnectedClient.user, disconnected: true }),
                            mockUserInfo({ user: connectedClients[1].user }),
                        ),
                        userId: disconnectedClient.userId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[0], HostPacketType.USER_RECONNECTED, {
                        userId: disconnectedClient.userId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, newPeerId, HostPacketType.USER_RECONNECTED, {
                        userId: disconnectedClient.userId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerIds[2], HostPacketType.USER_RECONNECTED, {
                        userId: disconnectedClient.userId,
                    }),
                ]);
            });

            it("has no disconnected users", () =>
                [scenario.host, ...scenario.clients].forEach((peer) => expect(peer.disconnectedUsers).toEqual([])));

            it("knows of all users", () =>
                [scenario.host, ...scenario.clients].forEach((peer) =>
                    expect(peer.users).toEqual(
                        mockUserList(scenario.host.user, ...scenario.clients.map((client) => client.user)),
                    ),
                ));

            it("fires 'userreconnect'", () =>
                spyReconnects.forEach((spy) => expect(spy).toHaveBeenCalledWith(disconnectedClient.user)));

            it("fires 'open' on client site", () => expect(spyOpen).toHaveBeenCalledWith());

            it("doesn't fire 'userconnect'", () =>
                spyUserConnects.forEach((spy) => expect(spy).not.toHaveBeenCalled()));
        });

        describe("with a new instance", () => {
            let newClient: Client<MockUser, MockMessageType>;

            beforeEach(async (done) => {
                newClient = new Client(mockPeerOptions());
                let eventReceivedCount = 0;
                [scenario.host, ...connectedClients, newClient].forEach((peer, index) => {
                    peer.on("userreconnect", spyReconnects[index]);
                    peer.on("userconnect", spyUserConnects[index]);
                    peer.once("userreconnect", () => {
                        eventReceivedCount++;
                        if (eventReceivedCount === 4) {
                            done();
                        }
                    });
                });
                newClient.on("open", spyOpen);
                const result = await newClient.open(scenario.hostPeerId, disconnectedClient.userId);
                newPeerId = result.peerId;
            });

            it("has no disconnected users", () =>
                [scenario.host, ...connectedClients, newClient].forEach((peer) =>
                    expect(peer.disconnectedUsers).toEqual([]),
                ));

            it("knows of all users", () =>
                [scenario.host, ...connectedClients, newClient].forEach((peer) =>
                    expect(peer.users).toEqual(
                        mockUserList(scenario.host.user, ...scenario.clients.map((client) => client.user)),
                    ),
                ));

            it("fires 'userreconnect'", () =>
                spyReconnects.forEach((spy) => expect(spy).toHaveBeenCalledWith(disconnectedClient.user)));

            it("fires 'open' on client site", () => expect(spyOpen).toHaveBeenCalledWith());

            it("doesn't fire 'userconnect'", () =>
                spyUserConnects.forEach((spy) => expect(spy).not.toHaveBeenCalled()));
        });
    });
});
