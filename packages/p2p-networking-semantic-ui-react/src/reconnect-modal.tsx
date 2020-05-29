import * as React from "react";
import { Button, Header, Modal, ModalProps } from "semantic-ui-react";
import { computed, action, observable } from "mobx";
import { observer } from "mobx-react";
import { ObservablePeer, ObservableClient, ObservableHost } from "p2p-networking-mobx";
import { User, NetworkMode } from "p2p-networking";

export interface ReconnectModalProps<TUser extends User, TMessageType extends string | number> extends ModalProps {
    peer?: ObservablePeer<TUser, TMessageType>;
    translations?: {
        header?: string;
        description?: string;
        reconnect?: string;
        errorHeader?: string;
        errorDescription?: string;
        hostDescription?: string;
        dismiss?: string;
    };
}

@observer
export class ReconnectModal<TUser extends User, TMessageType extends string | number> extends React.Component<
    ReconnectModalProps<TUser, TMessageType>
> {
    @observable private reconnectLoading = false;
    @observable private error = false;
    @observable private dismissed = false;

    @action.bound private async handleReconnectClick(): Promise<void> {
        if (!(this.props.peer instanceof ObservableClient)) {
            return;
        }
        this.reconnectLoading = true;
        try {
            await this.props.peer.reconnect();
        } catch (err) {
            this.error = true;
        }
        this.reconnectLoading = false;
    }

    @computed private get translationErrorHeader(): string {
        return this.props.translations?.errorHeader ?? "Reconnect failed";
    }

    @computed private get translationHeader(): string {
        return this.props.translations?.header ?? "Disconnected";
    }

    @computed private get translationErrorDescription(): string {
        return (
            this.props.translations?.errorDescription ??
            "Could not reconnect. Perhaps the network is unavailable or you have been kicked?"
        );
    }

    @computed private get translationHostDescription(): string {
        return this.props.translations?.hostDescription ?? "You disconnected as host. Network terminated.";
    }

    @computed private get translationDescription(): string {
        return (
            this.props.translations?.description ??
            "You have been disconnected from the host. Do you want to reconnect?"
        );
    }

    @computed private get translationReconnect(): string {
        return this.props.translations?.reconnect ?? "Reconnect";
    }

    @computed private get translationDismiss(): string {
        return this.props.translations?.dismiss ?? "Dismiss";
    }

    @computed private get open(): boolean {
        return (
            !this.dismissed &&
            Boolean(this.props.peer?.networkMode === NetworkMode.DISCONNECTED && this.props.peer.hostConnectionId)
        );
    }

    @action.bound private handleClose(): void {
        this.dismissed = true;
    }

    public render(): JSX.Element {
        const { translations: _translations, peer, ...rest } = this.props;
        if (!peer) {
            return <></>;
        }
        return (
            <Modal open={this.open} basic size="small" {...rest} onClose={this.handleClose}>
                <Header
                    icon="warning circle"
                    content={this.error ? this.translationErrorHeader : this.translationHeader}
                />
                {this.error && <Modal.Content>{this.translationErrorDescription}</Modal.Content>}
                <Modal.Content>
                    {peer instanceof ObservableHost ? this.translationHostDescription : this.translationDescription}
                </Modal.Content>
                <Modal.Actions>
                        <Button
                            basic
                            inverted
                            content={this.translationDismiss}
                            icon="cancel"
                            onClick={this.handleClose}
                        />
                    {peer instanceof ObservableClient && (
                        <Button
                            basic
                            inverted
                            content={this.translationReconnect}
                            icon="sign in"
                            loading={this.reconnectLoading}
                            disabled={this.reconnectLoading}
                            onClick={this.handleReconnectClick}
                        />
                    )}
                </Modal.Actions>
            </Modal>
        );
    }
}
