import * as React from "react";
import * as ReactDOM from "react-dom";
import { Host } from "p2p-events";

const applicationProtocolVersion = "1.0.0";
const host = new Host({ user: {}, applicationProtocolVersion });

ReactDOM.render(
    <div>
        Hi I am {host.userId}
    </div>,
    document.getElementById("app"),
);