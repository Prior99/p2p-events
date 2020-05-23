import * as React from "react";
import * as ReactDOM from "react-dom";
import { Host, Client, Peer } from "p2p-events";
import { Messages, TodoUser } from "./types";
import { App } from "./app";

const applicationProtocolVersion = "1.0.0";

async function createPeer(): Promise<Peer<TodoUser, Messages>> {
    const options = { user: { name: "Unknown" }, applicationProtocolVersion };
    if (location.hash) {
        const client = new Client<TodoUser, Messages>(options);
        await client.open(location.hash.replace("#", ""));
        return client;
    }
    const host = new Host<TodoUser, Messages>({ ...options, pingInterval: 5 });
    await host.open();
    return host;
}


async function main(): Promise<void> {
    const peer = await createPeer();

    ReactDOM.render(<App peer={peer} />, document.getElementById("app"));
}

main();
