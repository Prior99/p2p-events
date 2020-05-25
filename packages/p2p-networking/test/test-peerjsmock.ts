jest.mock("peerjs");

import PeerJS from "peerjs";

describe("PeerJS mock", () => {
    let peerA: PeerJS;
    let peerB: PeerJS;

    beforeEach(() => {
        peerA = new PeerJS(null as any);
        peerB = new PeerJS(null as any);
    });

    describe("with A listening for connection from B", () => {
        let spyConnection: jest.MockedFunction<any>;

        beforeEach(() => {
            spyConnection = jest.fn();
            peerA.on("connection", spyConnection);
        });

        describe("with B connecting to A", () => {
            beforeEach(() => {
                peerB.connect(peerA.id);
            });

            it("invoked the connection callback on A", () => {
                expect(spyConnection).toHaveBeenCalledWith({
                    on: expect.any(Function),
                    off: expect.any(Function),
                    send: expect.any(Function),
                    close: expect.any(Function),
                });
            });
        });

        describe("with A waiting for messages from B", () => {
            let spyDataA: jest.MockedFunction<any>;
            let someData: any;
            let connectionA: PeerJS.DataConnection;
            let connectionB: PeerJS.DataConnection;

            beforeEach(async () => {
                spyDataA = jest.fn();
                someData = { test: "test" };
                spyConnection.mockImplementation((conn: any) => {
                    connectionA = conn;
                    connectionA.on("data", spyDataA);
                });
                connectionB = peerB.connect(peerA.id);
                connectionB.send(someData);
                await new Promise((resolve) => setTimeout(resolve, 20));
            });

            it("invoked the data listener on A", () => {
                expect(spyDataA).toBeCalledWith(someData);
            });

            describe("with B waiting for messages from A", () => {
                let spyDataFromA: jest.MockedFunction<any>;
                let someOtherData: any;
                let spyDataB: jest.MockedFunction<any>;

                beforeEach(async () => {
                    spyDataFromA = jest.fn();
                    spyDataB = jest.fn();
                    someOtherData = { test2: "test2" };
                    connectionB.on("data", spyDataB);
                    connectionA.send(someOtherData);
                    await new Promise((resolve) => setTimeout(resolve, 20));
                });

                it("invoked the data listener on B", () => {
                    expect(spyDataB).toBeCalledWith(someOtherData);
                });

                it("invoked the data listener on A only once", () => {
                    expect(spyDataA).not.toBeCalledWith(someOtherData);
                });
            });
        });
    });
});
