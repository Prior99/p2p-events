jest.mock("peerjs");
import { ClientPacketType, HostPacketType, ErrorReason } from "../src";
import { resetHistory, getHistory } from "./packet-history";
import { mockHistoryPacket, mockVersion, mockUserInfo, ScenarioSimple, scenarioSimple } from "./utils";

describe("Open connection", () => {
    let scenario: ScenarioSimple;

    beforeEach(async () => (scenario = await scenarioSimple()));

    it("host knows both users", () =>
        expect(scenario.host.users).toEqual(
            [scenario.host.user, scenario.client.user].sort((a, b) => a.id.localeCompare(b.id)),
        ));

    it("client knows both users", () =>
        expect(scenario.client.users).toEqual(
            [scenario.host.user, scenario.client.user].sort((a, b) => a.id.localeCompare(b.id)),
        ));

    it("client is client", () => expect(scenario.client.isClient).toBe(true));

    it("client is not host", () => expect(scenario.client.isHost).toBe(false));

    it("client is connected", () => expect(scenario.client.isConnected).toBe(true));

    it("client is not connecting", () => expect(scenario.client.isConnecting).toBe(false));

    it("client is not disconnected", () => expect(scenario.client.isDisconnected).toBe(false));

    it("host is not client", () => expect(scenario.host.isClient).toBe(false));

    it("host is host", () => expect(scenario.host.isHost).toBe(true));

    it("has the same host connection ids for both peers", () =>
        expect(scenario.host.hostConnectionId).toBe(scenario.client.hostConnectionId));

    describe("after closing the connection to the client", () => {
        beforeEach(async () => {
            scenario.host.closeConnectionToClient(scenario.client.userId);
            await new Promise((resolve) => setTimeout(resolve));
        });

        it("removed the client from the set of users", () => expect(scenario.host.users).toEqual([scenario.host.user]));
    });

    it("can't close connection to itself", () =>
        expect(() => scenario.host.closeConnectionToClient(scenario.host.userId)).toThrowError());

    describe("after closing the connection to an unknown client", () => {
        let spyError: jest.MockedFunction<any>;

        beforeEach(async () => {
            spyError = jest.fn();
            scenario.host.once("error", spyError);
            scenario.host.closeConnectionToClient("unknown-id");
        });

        it("calls the error handler", () =>
            expect(spyError).toHaveBeenCalledWith(expect.any(Error), ErrorReason.INTERNAL));
    });

    describe("after disconnecting", () => {
        let spyUserDisconnect: jest.MockedFunction<any>;

        beforeEach((done) => {
            spyUserDisconnect = jest.fn(() => done());
            scenario.host.on("userdisconnect", spyUserDisconnect);
            resetHistory();
            scenario.client.close();
        });

        it("fires the event", () => expect(spyUserDisconnect).toHaveBeenCalledWith(scenario.client.userId));

        it("has sent the expected Packets", () => {
            expect(getHistory()).toEqual([
                {
                    from: scenario.clientPeerId,
                    to: scenario.hostPeerId,
                    data: {
                        packetType: ClientPacketType.DISCONNECT,
                    },
                },
                {
                    from: scenario.hostPeerId,
                    to: scenario.clientPeerId,
                    data: {
                        packetType: HostPacketType.USER_DISCONNECTED,
                        userId: scenario.client.userId,
                    },
                },
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

    it("has sent the expected Packets", () => {
        expect(getHistory()).toEqual([
            mockHistoryPacket(scenario.clientPeerId, scenario.hostPeerId, ClientPacketType.HELLO, {
                versions: mockVersion(),
                user: scenario.client.user,
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerId, HostPacketType.WELCOME, {
                users: [mockUserInfo({ user: scenario.host.user })],
            }),
            mockHistoryPacket(scenario.hostPeerId, scenario.clientPeerId, HostPacketType.USER_CONNECTED, {
                user: scenario.client.user,
            }),
        ]);
    });

    it("has both users on host side", () => {
        const expected = [
            {
                id: scenario.host.userId,
                name: "Mr. Host",
            },
            {
                id: scenario.client.userId,
                name: "Mr. Client",
            },
        ].sort((a, b) => a.id.localeCompare(b.id));
        expect(scenario.host.users).toEqual(expected);
    });
});
