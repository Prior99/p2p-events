import * as React from "react";
import { observer } from "mobx-react";
import { TodoUser } from "./types";
import { PingInfo } from "p2p-networking";

export interface CollaboratorListProps {
    collaborators: TodoUser[];
    pingInfo: Map<string, PingInfo>;
}

@observer
export class CollaboratorList extends React.Component<CollaboratorListProps> {
    public render(): JSX.Element {
    const { collaborators, pingInfo } = this.props;
    return (
        <ul>
            {collaborators.map((user) => (
                <li key={user.id}>
                    {user.name} (<i>{user.id}</i>) {(pingInfo.get(user.id)?.roundTripTime ?? 0) * 1000}ms
                </li>
            ))}
        </ul>
    );
}
}
