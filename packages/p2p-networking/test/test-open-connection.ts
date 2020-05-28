import { ClientPacketType, HostPacketType, ErrorReason, Host } from "../src";
import { getHistory } from "./packet-history";
import { mockHistoryPacket, mockVersion, mockUserInfo, ScenarioSimple, scenarioSimple, mockUserList } from "./utils";

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

    it("can't close connection to itself", () =>
        expect(() => scenario.host.closeConnectionToClient(scenario.host.userId)).toThrowError());

    describe("after closing the connection to the client", () => {
        beforeEach(async () => {
            scenario.host.closeConnectionToClient(scenario.client.userId);
            await new Promise((resolve) => setTimeout(resolve));
        });

        it("removed the client from the set of users", () => expect(scenario.host.users).toEqual([scenario.host.user]));
    });

    it("can't kick unknown user", () => expect(() => scenario.host.kickUser("unknown-id")).toThrowError());

    describe("after kicking the client", () => {
        beforeEach(async () => {
            await scenario.host.kickUser(scenario.client.userId);
        });

        it("doesn't know the user", () => expect(scenario.host.users).toEqual([scenario.host.user]));

        it("doesn't know the user as disconnected", () => expect(scenario.host.disconnectedUsers).toEqual([]));
    });

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
        expect(scenario.host.users).toEqual(
            mockUserList(
                {
                    id: scenario.host.userId,
                    name: "Mr. Host",
                },
                {
                    id: scenario.client.userId,
                    name: "Mr. Client",
                },
            ),
        );
    });
});
