import { mockPeerOptions, MockUser, MockMessageType } from "./utils";
import { Client } from "../src";

let client: Client<MockUser, MockMessageType>;

describe("With peerjs encountering an error", () => {
    let rejectResult: any;

    beforeEach(async () => {
        client = new Client(mockPeerOptions({ user: { name: "Mr. Client" } }));
        try {
            await client.open("broken-id");
        } catch (err) {
            rejectResult = err;
        }
    });

    it("rejects", () => expect(rejectResult).toEqual(expect.any(Error)));
});
