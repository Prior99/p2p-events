import { v4 as uuid } from "uuid";

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
        this.listeners.push({ eventName, handler });
    });

    private invokeListener(eventName: string, ...args: any[]): void {
        this.listeners
            .filter((listener) => listener.eventName === eventName)
            .forEach(({ handler }) => handler(...args));
    }

    public connect = jest.fn((remoteId) => {
        connections.get(remoteId)!.push(this.id);
        const connection = {
            on: jest.fn((eventName: string, handler: Function) => {
                openConnections.push({
                    from: this.id,
                    to: remoteId,
                    handler,
                });
            }),
            send: jest.fn((data: any) => {
                openConnections
                    .filter(({ from, to }) => from === this.id && to === remoteId)
                    .forEach(({ handler }) => handler(data));
            }),
        };
        instances.get(remoteId)!.invokeListener("connection", connection);
        return connection;
    });
}

export default MockPeerJS;
