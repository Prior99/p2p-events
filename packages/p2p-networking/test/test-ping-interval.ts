import { createHost, createClient, Host, Client } from "../src";
import { mockPeerOptions, MockUser, MockMessageType } from "./utils";
import { resetHistory } from "./packet-history";

describe("Ping interval", () => {
    let spyPing: jest.MockedFunction<any>;
    let host: Host<MockUser, MockMessageType>;
    let client: Client<MockUser, MockMessageType>;

    beforeEach(async (done) => {
        spyPing = jest.fn(() => {
            host.stopPing();
            done();
        });
        host = await createHost(mockPeerOptions());
        client = await createClient(mockPeerOptions(), host.hostConnectionId!);
        resetHistory();
        client.once("pinginfo", spyPing);
    });

    it("calls the ping handler", () => expect(spyPing).toBeCalled());
});
