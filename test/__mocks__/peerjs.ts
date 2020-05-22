import { v4 as uuid } from "uuid";
import { addEntry } from "../message-history";

const connections = new Map<string, string[]>();
const instances = new Map<string, MockPeerJS>();
const openConnections: {
    from: string;
    to: string;
    handler: Function;
}[] = [];

export class MockPeerJS {
    public id = uuid();
    private listeners: { eventName: string; handler: Function }[] = [];

    constructor() {
        connections.set(this.id, []);
        instances.set(this.id, this);
    }

    public destroy = jest.fn();

    public on = jest.fn((eventName, handler) => {
        if (eventName === "open") { handler(); }
        this.listeners.push({ eventName, handler });
    });

    private invokeListener(eventName: string, ...args: any[]): void {
        this.listeners
            .filter((listener) => listener.eventName === eventName)
            .forEach(({ handler }) => handler(...args));
    }

    public connect = jest.fn((remoteId) => {
        connections.get(remoteId)!.push(this.id);
        instances.get(remoteId)!.invokeListener("connection", {
            on: jest.fn((eventName: string, handler: Function) => {
                if (eventName === "open") {
                    handler();
                    return;
                }
                openConnections.push({
                    from: this.id,
                    to: remoteId,
                    handler,
                });
            }),
            send: jest.fn((data: any) => {
                addEntry({
                    from: remoteId,
                    to: this.id,
                    data,
                });
                openConnections
                    .filter(({ from, to }) => from === remoteId && to === this.id)
                    .forEach(({ handler }) => handler(data));
            }),
        });
        return {
            on: jest.fn((eventName: string, handler: Function) => {
                if (eventName === "open") {
                    handler();
                    return;
                }
                openConnections.push({
                    from: remoteId,
                    to: this.id,
                    handler,
                });
            }),
            send: jest.fn((data: any) => {
                addEntry({
                    from: this.id,
                    to: remoteId,
                    data,
                });
                openConnections
                    .filter(({ from, to }) => from === this.id && to === remoteId)
                    .forEach(({ handler }) => handler(data));
            }),
        };
    });
}

export default MockPeerJS;
