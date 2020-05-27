import { Host, createHost, createClient, IncompatibilityError, IncompatibleVersion } from "../src";
import { MockUser, MockMessageType, mockPeerOptions } from "./utils";
import { libraryVersion } from "../generated/version";

describe("Incompatible versions", () => {
    let rejectResult: any;
    let host: Host<MockUser, MockMessageType>;

    beforeEach(async () => {
        host = await createHost(mockPeerOptions({ applicationProtocolVersion: "1" }));
        try {
            await createClient(mockPeerOptions({ applicationProtocolVersion: "2" }), host.hostConnectionId!);
        } catch (err) {
            rejectResult = err;
        }
    });

    it("can't connect", () => {
        expect(rejectResult).toEqual(expect.any(IncompatibilityError));
        expect(rejectResult.incompatibleVersions).toEqual([IncompatibleVersion.APPLICATION_PROTOCOL_VERSION]);
        expect(rejectResult.localVersions).toEqual({ application: "2", p2pNetwork: libraryVersion });
        expect(rejectResult.hostVersions).toEqual({ application: "1", p2pNetwork: libraryVersion });
    });
});
