import * as React from "react";
import { DimmerProps, Loader, Dimmer } from "semantic-ui-react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { ObservablePeer } from "p2p-networking-mobx";
import { User, NetworkMode } from "p2p-networking";

export interface ConnectLoaderProps<TUser extends User, TMessageType extends string | number> extends DimmerProps {
    peer?: ObservablePeer<TUser, TMessageType>;
    translations?: {
        loading?: string;
    };
}

@observer
export class ConnectLoader<TUser extends User, TMessageType extends string | number> extends React.Component<
    ConnectLoaderProps<TUser, TMessageType>
> {
    @computed private get translationLoading(): string {
        return this.props.translations?.loading ?? "Connecting...";
    }

    public render(): JSX.Element {
        const { translations: _translations, peer, ...rest } = this.props;
        return (
            <Dimmer active={peer?.networkMode === NetworkMode.CONNECTING} {...rest}>
                <Loader>{this.translationLoading}</Loader>
            </Dimmer>
        );
    }
}
