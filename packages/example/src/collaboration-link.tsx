import * as React from "react";
import { observer } from "mobx-react";

export interface CollaborationLinkProps {
    peerId?: string;
    userId?: string;
}

@observer
export class CollaborationLink extends React.Component<CollaborationLinkProps> {
    public render(): JSX.Element {
        const { peerId, userId } = this.props;
        const url = `${location.origin}${location.pathname}#${peerId}/${userId ?? ""}`;
        return peerId ? (
            <a href={url} target="_blank" rel="noreferrer">
                Link
            </a>
        ) : (
            <></>
        );
    }
}
