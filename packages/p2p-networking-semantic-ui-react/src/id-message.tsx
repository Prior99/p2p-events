import * as React from "react";
import { Popup, Message, Icon, MessageProps, PopupProps } from "semantic-ui-react";
import { computed, action } from "mobx";
import { observer } from "mobx-react";
import { ObservablePeer } from "p2p-networking-mobx";
import { User } from "p2p-networking";

export interface IdMessageProps<TUser extends User, TMessageType extends string | number> extends MessageProps {
    peer: ObservablePeer<TUser, TMessageType>;
    translations?: {
        loadingHeader?: string;
        loadingDescription?: string;
        disconnectedHeader?: string;
        disconnectedDescription?: string;
        copiedToClipboard?: string;
        cantCopy?: (url: string) => string;
    };
    urlFactory: (id: string) => string;
    popupProps?: PopupProps;
}

@observer
export class IdMessage<TUser extends User, TMessageType extends string | number> extends React.Component<
    IdMessageProps<TUser, TMessageType>
> {
    @action.bound private async handleIdClick(): Promise<void> {
        if (this.hasClipboardApi) {
            await navigator.clipboard.writeText(this.url);
        }
    }

    @computed private get hasClipboardApi(): boolean {
        return Boolean(navigator.clipboard);
    }

    @computed private get url(): string {
        return this.props.urlFactory(this.props.peer.hostConnectionId ?? "");
    }

    @computed private get popupText(): string {
        if (this.hasClipboardApi) {
            return this.translationCopiedToClipboard;
        }
        return this.translationCantCopy;
    }

    @computed private get translationCopiedToClipboard(): string {
        return this.props.translations?.copiedToClipboard ?? "Copied to clipboard.";
    }

    @computed private get translationCantCopy(): string {
        if (this.props.translations?.cantCopy) {
            return this.props.translations.cantCopy(this.url);
        }
        return `Can't copy to clipboard: "${this.url}".`;
    }

    @computed private get translationDisconnectedHeader(): string {
        return this.props.translations?.disconnectedHeader ?? "Disconnected";
    }

    @computed private get translationDisconnectedDescription(): string {
        return this.props.translations?.disconnectedDescription ?? "Peer connection closed.";
    }

    @computed private get translationLoadingHeader(): string {
        return this.props.translations?.loadingHeader ?? "Loading...";
    }

    @computed private get translationLoadingDescription(): string {
        return this.props.translations?.loadingDescription ?? "Waiting to open peer connection.";
    }

    public render(): JSX.Element {
        const { translations: _translations, urlFactory: _urlFactory, peer, popupProps, ...rest } = this.props;
        if (peer.isDisconnected) {
            return (
                <Message negative {...rest} icon>
                    <Icon name="warning circle" />
                    <Message.Content>
                        <Message.Header>{this.translationDisconnectedHeader}</Message.Header>
                        {this.translationDisconnectedDescription}
                    </Message.Content>
                </Message>
            );
        }
        if (peer.isConnecting) {
            return (
                <Message blue {...rest} icon>
                    <Icon name="circle notched" loading />
                    <Message.Content>
                        <Message.Header>{this.translationLoadingHeader}</Message.Header>
                        {this.translationLoadingDescription}
                    </Message.Content>
                </Message>
            );
        }
        return (
            <Popup
                {...popupProps}
                on="click"
                inverted
                trigger={
                    <Message
                        {...rest}
                        positive
                        icon="globe"
                        onClick={this.handleIdClick}
                        content={this.props.peer.hostConnectionId}
                    />
                }
                content={this.popupText}
            />
        );
    }
}
