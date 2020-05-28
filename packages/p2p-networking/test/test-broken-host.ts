import * as peerjs from "peerjs";
import { createHost } from "../src";
import { mockPeerOptions } from "./utils";

describe("Broken peerjs", () => {
    beforeEach(() =>
        jest.spyOn(peerjs as any, "default").mockImplementation(
            () =>
                class {
                    public on(name: string, handler: any): void {
                        if (name === "error") {
                            handler(new Error("some error"));
                        }
                    }
                },
        ),
    );

    afterEach(() => jest.spyOn(peerjs as any, "default").mockRestore());

    it("can't create host", () =>
        expect(createHost(mockPeerOptions(), { name: "test" })).rejects.toEqual(expect.any(Error)));
});
