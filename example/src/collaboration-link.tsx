import * as React from "react";
import { observer } from "mobx-react";

export interface CollaborationLinkProps {
    peerId?: string;
}

@observer
export class CollaborationLink extends React.Component<CollaborationLinkProps> {
    public render(): JSX.Element {
        const { peerId } = this.props;
        const url = `${location.origin}${location.pathname}#${peerId}`;
        return peerId ? (
            <a href={url} target="_blank">
                Link
            </a>
        ) : (
            <></>
        );
    }
}
