import {
    ScenarioSimple,
    scenarioSimple,
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
import { ClientPacketType, HostPacketType, Client, ErrorReason } from "../src";

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

    it("lists the user as disconnected", () => expect(scenario.host.disconnectedUsers).toEqual([scenario.client.user]));

    it("removed the user from host's users", () => expect(scenario.host.users).toEqual([scenario.host.user]));

    describe("after kicking the disconnected user", () => {
        let spyKick: jest.MockedFunction<any>;

        beforeEach(async () => {
            spyKick = jest.fn();
            resetHistory();
            scenario.host.on("userkick", spyKick);
            await scenario.host.kickUser(scenario.client.userId);
        });

        it("calls the 'userkick' event listener", () => expect(spyKick).toHaveBeenCalledWith(scenario.client.userId));

        it("doesn't lists the user as disconnected", () => expect(scenario.host.disconnectedUsers).toEqual([]));

        it("removed the user from host's users", () => expect(scenario.host.users).toEqual([scenario.host.user]));

        describe("reconnecting the kicked user", () => {
            let spyReconnectHost: jest.MockedFunction<any>;
            let spyUserConnect: jest.MockedFunction<any>;
            let spyOpen: jest.MockedFunction<any>;
            let spyHostError: jest.MockedFunction<any>;
            let spyClientError: jest.MockedFunction<any>;
            let rejectValue: any;

            beforeEach(async () => {
                resetHistory();
                spyReconnectHost = jest.fn();
                spyUserConnect = jest.fn();
                spyHostError = jest.fn();
                spyClientError = jest.fn();
                spyOpen = jest.fn();
                scenario.host.on("userreconnect", spyReconnectHost);
                scenario.host.on("userconnect", spyUserConnect);
                scenario.client.on("error", spyClientError);
                scenario.client.on("open", spyOpen);
                scenario.host.on("error", spyHostError);
                await scenario.client
                    .open(scenario.hostPeerId, scenario.client.userId)
                    .catch((err) => (rejectValue = err));
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            it("rejects", () => expect(rejectValue).toEqual(expect.any(Error)));

            it("doesn't fire 'userreconnect' on host site", () => expect(spyReconnectHost).not.toHaveBeenCalled());

            it("doesn't fire 'error' on host site", () => expect(spyHostError).not.toHaveBeenCalled());

            it("doesn't fire 'open' on client site", () => expect(spyOpen).not.toHaveBeenCalled());

            it("fires 'error' on client site", () =>
                expect(spyClientError).toHaveBeenCalledWith(expect.any(Error), ErrorReason.OTHER));
        });
    });

    describe("reconnecting", () => {
        let spyReconnectHost: jest.MockedFunction<any>;
        let spyReconnectClient: jest.MockedFunction<any>;
        let spyUserConnect: jest.MockedFunction<any>;
        let spyOpen: jest.MockedFunction<any>;
        let newPeerId: string;

        beforeEach(async () => {
            resetHistory();
            spyReconnectHost = jest.fn();
            spyReconnectClient = jest.fn();
            spyUserConnect = jest.fn();
            spyOpen = jest.fn();
            scenario.host.on("userreconnect", spyReconnectHost);
            scenario.host.on("userconnect", spyUserConnect);
        });

        describe("with an unknown user id", () => {
            let spyHostError: jest.MockedFunction<any>;
            let spyClientError: jest.MockedFunction<any>;
            let rejectValue: any;

            beforeEach(async () => {
                resetHistory();
                spyHostError = jest.fn();
                spyClientError = jest.fn();
                scenario.client.on("error", spyClientError);
                scenario.client.on("open", spyOpen);
                scenario.host.on("error", spyHostError);
                await scenario.client.open(scenario.hostPeerId, "unknown-id").catch((err) => (rejectValue = err));
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            it("rejects", () => expect(rejectValue).toEqual(expect.any(Error)));

            it("doesn't fire 'userreconnect' on host site", () => expect(spyReconnectHost).not.toHaveBeenCalled());

            it("doesn't fire 'error' on host site", () => expect(spyHostError).not.toHaveBeenCalled());

            it("doesn't fire 'open' on client site", () => expect(spyOpen).not.toHaveBeenCalled());

            it("fires 'error' on client site", () =>
                expect(spyClientError).toHaveBeenCalledWith(expect.any(Error), ErrorReason.OTHER));
        });

        describe("with the same instance", () => {
            beforeEach(async () => {
                resetHistory();
                scenario.client.on("userreconnect", spyReconnectClient);
                scenario.client.on("open", spyOpen);
                const result = await scenario.client.reconnect();
                newPeerId = result.peerId;
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            it("has sent the expected Packets", () => {
                expect(getHistory()).toEqual([
                    mockHistoryPacket(newPeerId, scenario.hostPeerId, ClientPacketType.HELLO_AGAIN, {
                        userId: scenario.client.userId,
                        versions: mockVersion(),
                    }),
                    mockHistoryPacket(scenario.hostPeerId, newPeerId, HostPacketType.WELCOME_BACK, {
                        users: mockUserInfoList(
                            mockUserInfo({ user: scenario.host.user! }),
                            mockUserInfo({ user: scenario.client.user!, disconnected: true }),
                        ),
                        userId: scenario.client.userId,
                    }),
                    mockHistoryPacket(scenario.hostPeerId, newPeerId, HostPacketType.USER_RECONNECTED, {
                        userId: scenario.client.userId,
                    }),
                ]);
            });

            it("knows of both users on client side", () =>
                expect(scenario.client.users).toEqual(mockUserList(scenario.host.user!, scenario.client.user!)));

            it("knows of both users on host side", () =>
                expect(scenario.host.users).toEqual(mockUserList(scenario.host.user!, scenario.client.user!)));

            it("fires 'userreconnect' on host site", () =>
                expect(spyReconnectHost).toHaveBeenCalledWith(scenario.client.user));

            it("fires 'userreconnect' on client site", () =>
                expect(spyReconnectClient).toHaveBeenCalledWith(scenario.client.user));

            it("fires 'open' on client site", () => expect(spyOpen).toHaveBeenCalledWith());

            it("doesn't fire 'userconnect'", () => expect(spyUserConnect).not.toHaveBeenCalled());
        });

        describe("with a new instance", () => {
            let newClient: Client<MockUser, MockMessageType>;

            beforeEach(async () => {
                newClient = new Client(mockPeerOptions());
                newClient.on("userreconnect", spyReconnectClient);
                newClient.on("open", spyOpen);
                const result = await newClient.open(scenario.hostPeerId, scenario.client.userId);
                newPeerId = result.peerId;
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            it("knows of both users on client side", () =>
                expect(newClient.users).toEqual(mockUserList(scenario.host.user!, scenario.client.user!)));

            it("knows of both users on host side", () =>
                expect(scenario.host.users).toEqual(mockUserList(scenario.host.user!, scenario.client.user!)));

            it("fires 'userreconnect' on host site", () =>
                expect(spyReconnectHost).toHaveBeenCalledWith(scenario.client.user));

            it("fires 'userreconnect' on client site", () =>
                expect(spyReconnectClient).toHaveBeenCalledWith(scenario.client.user));

            it("fires 'open' on client site", () => expect(spyOpen).toHaveBeenCalledWith());

            it("doesn't fire 'userconnect'", () => expect(spyUserConnect).not.toHaveBeenCalled());
        });
    });
});
