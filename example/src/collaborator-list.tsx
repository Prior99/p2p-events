import * as React from "react";
import { TodoUser } from "./types";
import { PingInfo } from "../../dist/src";

export interface CollaboratorListProps {
    collaborators: TodoUser[];
    pingInfo: Map<string, PingInfo>;
}

export function CollaboratorList({ collaborators, pingInfo }: CollaboratorListProps): JSX.Element {
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
