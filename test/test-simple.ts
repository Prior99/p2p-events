jest.mock("peerjs");
import { Host, Client, ClientPacketType, HostPacketType, MessageFactory, SentMessageHandle } from "../src";
import { resetHistory, getHistory } from "./packet-history";
import { libraryVersion } from "../generated/version";

interface MockUser {
    id: string;
    name: string;
}

const enum MockMessageType {
    MOCK_MESSAGE = "mock message",
}

interface MockPayload {
    test: string;
}

describe("Simple", () => {
    let host: Host<MockUser, MockMessageType>;
    let client: Client<MockUser, MockMessageType>;
    let hostPeerId: string;
    let clientPeerId: string;

    beforeEach(async () => {
        resetHistory();
        host = new Host({ applicationProtocolVersion: "1.0.0", user: { name: "Mr. Host" } });
        client = new Client({ applicationProtocolVersion: "1.0.0", user: { name: "Mr. Client" } });
        const hostOpenResult = await host.open();
        hostPeerId = hostOpenResult.peerId;
        const clientOpenResult = await client.open(hostPeerId);
        clientPeerId = clientOpenResult.peerId;
    });

    it("has the same host connection ids for both peers", () =>
        expect(host.hostConnectionId).toBe(client.hostConnectionId));

    describe("after updating the user", () => {
        let spyUserUpdate: jest.MockedFunction<any>;

        beforeEach(() => {
            spyUserUpdate = jest.fn();
            host.on("userupdate", spyUserUpdate);
            resetHistory();
            client.updateUser({ name: "Mr. Newname" });
        });

        it("fires the event", () =>
            expect(spyUserUpdate).toHaveBeenCalledWith({ id: client.userId, name: "Mr. Newname" }));

        it("has sent the expected Packets", () => {
            expect(getHistory()).toEqual([
                {
                    from: clientPeerId,
                    to: hostPeerId,
                    data: {
                        packetType: ClientPacketType.UPDATE_USER,
                        user: {
                            name: "Mr. Newname",
                        },
                    },
                },
                {
                    from: hostPeerId,
                    to: clientPeerId,
                    data: {
                        packetType: HostPacketType.UPDATE_USER,
                        user: {
                            id: client.userId,
                            name: "Mr. Newname",
                        },
                    },
                },
            ]);
        });

        it("updates the user", () => {
            [client, host].forEach((peer) =>
                expect(peer.users).toEqual(
                    [
                        {
                            id: host.userId,
                            name: "Mr. Host",
                        },
                        {
                            id: client.userId,
                            name: "Mr. Newname",
                        },
                    ].sort((a, b) => a.id.localeCompare(b.id)),
                ),
            );
        });
    });

    describe("after disconnecting", () => {
        let spyUserDisconnect: jest.MockedFunction<any>;

        beforeEach(() => {
            spyUserDisconnect = jest.fn();
            host.on("userdisconnect", spyUserDisconnect);
            resetHistory();
            client.close();
        });

        it("fires the event", () => expect(spyUserDisconnect).toHaveBeenCalledWith(client.userId));

        it("has sent the expected Packets", () => {
            expect(getHistory()).toEqual([
                {
                    from: clientPeerId,
                    to: hostPeerId,
                    data: {
                        packetType: ClientPacketType.DISCONNECT,
                    },
                },
                {
                    from: hostPeerId,
                    to: clientPeerId,
                    data: {
                        packetType: HostPacketType.USER_DISCONNECTED,
                        userId: client.userId,
                    },
                },
            ]);
        });

        it("removed the user from host's users", () => {
            expect(host.users).toEqual([
                {
                    id: host.userId,
                    name: "Mr. Host",
                },
            ]);
        });
    });

    it("has sent the expected Packets", () => {
        expect(getHistory()).toEqual([
            {
                from: clientPeerId,
                to: hostPeerId,
                data: {
                    packetType: ClientPacketType.HELLO,
                    versions: {
                        application: "1.0.0",
                        p2pNetwork: libraryVersion,
                    },
                    user: client.user,
                },
            },
            {
                from: hostPeerId,
                to: clientPeerId,
                data: {
                    packetType: HostPacketType.WELCOME,
                    users: [
                        {
                            lastPingDate: expect.any(Number),
                            lostPingPackets: 0,
                            roundTripTime: undefined,
                            user: host.user,
                        },
                    ],
                },
            },
            {
                from: hostPeerId,
                to: clientPeerId,
                data: {
                    packetType: HostPacketType.USER_CONNECTED,
                    user: client.user,
                },
            },
        ]);
    });

    it("has both users on host side", () => {
        const expected = [
            {
                id: host.userId,
                name: "Mr. Host",
            },
            {
                id: client.userId,
                name: "Mr. Client",
            },
        ].sort((a, b) => a.id.localeCompare(b.id));
        expect(host.users).toEqual(expected);
    });

    describe("with a registered message", () => {
        let hostMessage: MessageFactory<MockMessageType, MockPayload>;
        let clientMessage: MessageFactory<MockMessageType, MockPayload>;
        let spyMessageHost: jest.MockedFunction<any>;
        let spyMessageClient: jest.MockedFunction<any>;

        beforeEach(async () => {
            spyMessageClient = jest.fn();
            spyMessageHost = jest.fn();
            resetHistory();
            hostMessage = host.message<MockPayload>(MockMessageType.MOCK_MESSAGE);
            clientMessage = client.message<MockPayload>(MockMessageType.MOCK_MESSAGE);
            hostMessage.subscribe(spyMessageHost);
            clientMessage.subscribe(spyMessageClient);
        });

        describe("host sending the event to client", () => {
            let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

            beforeEach(async () => {
                sendResult = hostMessage.send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the host", () =>
                expect(spyMessageHost).toHaveBeenCalledWith({ test: "something" }, host.userId, expect.any(Date)));

            it("called the listener on the client", () =>
                expect(spyMessageClient).toHaveBeenCalledWith({ test: "something" }, host.userId, expect.any(Date)));
        });

        describe("client sending the event to host", () => {
            let sendResult: SentMessageHandle<MockMessageType, MockPayload>;

            beforeEach(async () => {
                sendResult = clientMessage.send({ test: "something" });
                await sendResult.waitForAll();
            });

            it("called the listener on the host", () =>
                expect(spyMessageHost).toHaveBeenCalledWith({ test: "something" }, client.userId, expect.any(Date)));

            it("called the listener on the client", () =>
                expect(spyMessageClient).toHaveBeenCalledWith({ test: "something" }, client.userId, expect.any(Date)));

            it("has sent the expected Packets", () => {
                expect(getHistory()).toEqual([
                    {
                        from: clientPeerId,
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockMessageType.MOCK_MESSAGE,
                                originUserId: client.userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerId,
                        data: {
                            packetType: HostPacketType.ACKNOWLEDGED_BY_HOST,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerId,
                        data: {
                            packetType: HostPacketType.RELAYED_MESSAGE,
                            message: {
                                createdDate: expect.any(Number),
                                messageType: MockMessageType.MOCK_MESSAGE,
                                originUserId: client.userId,
                                serialId: sendResult.message.serialId,
                                payload: {
                                    test: "something",
                                },
                            },
                        },
                    },
                    {
                        from: clientPeerId,
                        to: hostPeerId,
                        data: {
                            packetType: ClientPacketType.ACKNOWLEDGE,
                            serialId: sendResult.message.serialId,
                        },
                    },
                    {
                        from: hostPeerId,
                        to: clientPeerId,
                        data: {
                            packetType: HostPacketType.ACKNOWLEDGED_BY_ALL,
                            serialId: sendResult.message.serialId,
                        },
                    },
                ]);
            });
        });
    });
});
