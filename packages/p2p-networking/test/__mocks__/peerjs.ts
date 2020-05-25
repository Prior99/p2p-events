import { v4 as uuid } from "uuid";
import { addEntry } from "../packet-history";

const connections = new Map<string, string[]>();
const instances = new Map<string, MockPeerJS>();
const openConnections: {
    from: string;
    to: string;
    handler: (...args: any[]) => any;
}[] = [];

function send(from: string, to: string, data: any): void {
    addEntry({
        from,
        to,
        data,
    });
    setTimeout(() => {
        openConnections
            .filter((connection) => from === connection.from && to === connection.to)
            .forEach(({ handler }) => handler(data));
    });
}

function addConnection(from: string, to: string, handler: (...args: any[]) => any): void {
    openConnections.push({ from, to, handler });
}

export default class MockPeerJS {
    public id = uuid();
    private listeners: { eventName: string; handler: (...args: any[]) => any }[] = [];

    constructor() {
        connections.set(this.id, []);
        instances.set(this.id, this);
    }

    public destroy = jest.fn();

    public on = jest.fn((eventName, handler) => {
        if (eventName === "open") {
            setTimeout(() => handler());
        }
        this.listeners.push({ eventName, handler });
    });

    public off = jest.fn((eventName, handler) => {
        this.listeners = this.listeners.filter(
            (listener) => listener.eventName !== eventName && listener.handler !== handler,
        );
    });

    private invokeListener(eventName: string, ...args: any[]): void {
        this.listeners
            .filter((listener) => listener.eventName === eventName)
            .forEach(({ handler }) => handler(...args));
    }

    public connect = jest.fn((remoteId) => {
        connections.get(remoteId)!.push(this.id);
        instances.get(remoteId)!.invokeListener("connection", {
            on: jest.fn((eventName: string, handler: (...args: any[]) => any) => {
                if (eventName === "error") {
                    return;
                }
                if (eventName === "open") {
                    setTimeout(() => handler());
                    return;
                }
                addConnection(this.id, remoteId, handler);
            }),
            off: jest.fn(() => undefined),
            send: jest.fn((data: any) => send(remoteId, this.id, data)),
        });
        return {
            on: jest.fn((eventName: string, handler: (...args: any[]) => any) => {
                if (eventName === "error") {
                    return;
                }
                if (eventName === "open") {
                    setTimeout(() => handler());
                    return;
                }
                addConnection(remoteId, this.id, handler);
            }),
            off: jest.fn(() => undefined),
            send: jest.fn((data: any) => send(this.id, remoteId, data)),
        };
    });
}
