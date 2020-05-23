import * as React from "react";

export interface CollaborationLinkProps {
    peerId?: string;
}

export function CollaborationLink({ peerId }: CollaborationLinkProps): JSX.Element {
    const url = `${location.origin}#${peerId}`;
    return peerId ? (
        <a href={url} target="_blank">
            Link
        </a>
    ) : (
        <></>
    );
}
