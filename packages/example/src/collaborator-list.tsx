import * as React from "react";
import { observer } from "mobx-react";
import { TodoUser, Messages } from "./types";
import { ObservablePeer } from "p2p-networking-mobx";
import { CollaborationLink } from "./collaboration-link";

export interface CollaboratorListProps {
    onUserKick?: (id: string) => void;
    peer: ObservablePeer<TodoUser, Messages>;
}

@observer
export class CollaboratorList extends React.Component<CollaboratorListProps> {
    public render(): JSX.Element {
        const { peer, onUserKick } = this.props;
        return (
            <ul>
                {peer.users.map((user) => (
                    <li key={user.id}>
                        {user.name} (<i>{user.id}</i>) {(peer.pingInfos.get(user.id)?.roundTripTime ?? 0) * 1000}ms
                        {onUserKick ? <button disabled={user.id === peer.userId} onClick={() => onUserKick(user.id)}>Kick</button> : <></>}
                    </li>
                ))}

                {peer.disconnectedUsers.map((user) => (
                    <li key={user.id}>
                        {user.name} <b>(Disconnected)</b> (<i>{user.id}</i>){" "}
                        {onUserKick ? <button onClick={() => onUserKick(user.id)}>Kick</button> : <></>}
                        <CollaborationLink peerId={peer.hostConnectionId} userId={user.id} />
                    </li>
                ))}
            </ul>
        );
    }
}
