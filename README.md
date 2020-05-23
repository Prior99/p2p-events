# p2p-networking

[![pipeline status](https://gitlab.com/prior99/p2p-networking/badges/master/pipeline.svg)](https://github.com/Prior99/p2p-networking)
[![coverage report](https://gitlab.com/prior99/p2p-networking/badges/master/coverage.svg)](https://github.com/Prior99/p2p-networking)

A simple message-oriented [WebRTC](https://webrtc.org/) ([PeerJS](https://peerjs.com/)) based p2p network.

## Resources

- [Example code](./example/src)
- [Api Reference](https://prior99.gitlab.io/p2p-networking/index.html)
- [Example](https://prior99.gitlab.io/p2p-networking/example/index.html)

## Example

```ts
// Each peer has a user associated. Users can have application specific properties that
// are synchronized across all peers in the network.
interface ExampleUser {
    name: string;
}

// An application specific protocol version needs to be specified.
// This version should be changed if breaking changes are introduced.
// If a peer encounters another peer with a different version, it will refuse to connect.
const applicationProtocolVersion = "0";

// Create a peer. If a peer id to connect to is given, connect as client and otherwise host.
async function createPeer(peerId?: string): Promise<Peer<ExampleUser, ExampleMessage>> {
    const name = !peerId ? "Mr. Host" : "Mr. Client";
    const options = { applicationProtocolVersion, user: { name } }
    if (host) {
        return await createHost(options);
    }
    return await createClient(options, peerId);
}

// Create the host.
const host = await createPeer();

// Connect to the host with two different client. This would likely be done in different
// browser windows on different devices and not in one application.
const client1 = await createPeer(host.hostConnectionId);
const client2 = await createPeer(host.hostConnectionId);

// An enum, string or number can be used to differentiate between messages.
enum ExampleMessages {
    EXAMPLE,
}

// Each message can has a typed specific payload.
interface ExamplePayload {
    example: string;
}

// In this method, the message for the type `ExampleMessages.EXAMPLE` is registered.
// It will return a `MessageFactory` which can be used to subscribe to messages or send then.
function registerExampleMessage(peer: Peer<ExampleUser, ExampleMessages>): MessageFactory<ExampleMessages, ExamplePayload> {
    return peer.message<ExamplePayload>(ExampleMessages.EXAMPLE);
}

// Make the host aware of the message `ExampleMessages.MESSAGE` and subscribe to it.
registerExampleMessage(host).subscribe(({ example }) => console.log(example));
// Make the first client aware of the message `ExampleMessages.MESSAGE` and subscribe to it.
registerExampleMessage(client1).subscribe(({ example }) => console.log(example));
// Make the second client aware of the message `ExampleMessages.MESSAGE`.
// Send a message to all peers on the network (including itself) and wait until all
// peers have received and acknowledged it.
await registerExampleMessage(client2).send({ example: "Hello there!" }).waitForAll();

```


## Contributing

Yarn is used as package manager.

* Install dependencies: `yarn`
* Build: `yarn build`
* Test: `yarn test`
* Lint: `yarn lint`
* Build the docs: `yarn docs`

## Contributors

* Andra Rübsteck
* Frederick Gnodtke (Prior99)
