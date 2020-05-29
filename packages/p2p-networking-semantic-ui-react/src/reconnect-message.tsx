import * as React from "react";
import { Message, Icon, MessageProps, Popup, Button } from "semantic-ui-react";
import { computed, action, observable } from "mobx";
import { observer } from "mobx-react";
import { ObservablePeer, ObservableHost } from "p2p-networking-mobx";
import { User } from "p2p-networking";

export interface ReconnectMessageProps<TUser extends User, TMessageType extends string | number> extends MessageProps {
    peer?: ObservablePeer<TUser, TMessageType>;
    translations?: {
        kick?: string;
        copyUrl?: string;
        header?: string;
        copiedToClipboard?: string;
        cantCopy?: (url: string) => string;
        description?: (name: string) => string;
    };
    userId: string;
    urlFactory: (id: string, user: TUser) => string;
    nameFactory: (user: TUser) => string;
}

@observer
export class ReconnectMessage<TUser extends User, TMessageType extends string | number> extends React.Component<
    ReconnectMessageProps<TUser, TMessageType>
> {
    @observable private kickLoading = false;

    @action.bound private async handleIdClick(): Promise<void> {
        if (!this.url) {
            return;
        }
        if (this.hasClipboardApi) {
            await navigator.clipboard.writeText(this.url);
        }
    }

    @action.bound private async handleKickClick(): Promise<void> {
        if (!(this.props.peer instanceof ObservableHost) || !this.user) {
            return;
        }
        this.kickLoading = true;
        await this.props.peer.kickUser(this.user.id);
        this.kickLoading = false;
    }

    @computed private get user(): TUser | undefined {
        return this.props.peer?.getUser(this.props.userId);
    }

    @computed private get hasClipboardApi(): boolean {
        return Boolean(navigator.clipboard);
    }

    @computed private get url(): string | undefined {
        if (!this.user) {
            return;
        }
        return this.props.urlFactory(this.props.peer?.hostConnectionId ?? "", this.user);
    }

    @computed private get popupText(): string {
        if (this.hasClipboardApi) {
            return this.translationCopiedToClipboard;
        }
        return this.translationCantCopy;
    }

    @computed private get name(): string {
        if (!this.user) {
            return "";
        }
        return this.props.nameFactory(this.user);
    }

    @computed private get translationCopiedToClipboard(): string {
        return this.props.translations?.copiedToClipboard ?? "Copied to clipboard.";
    }

    @computed private get translationCantCopy(): string {
        if (!this.url) {
            return "";
        }
        if (this.props.translations?.cantCopy) {
            return this.props.translations.cantCopy(this.url);
        }
        return `Can't copy to clipboard: "${this.url}".`;
    }

    @computed private get translationCopyUrl(): string {
        return this.props.translations?.copyUrl ?? "Copy re-invite URL";
    }

    @computed private get translationHeader(): string {
        return this.props.translations?.header ?? "User disconnected";
    }

    @computed private get translationDescription(): string {
        return this.props.translations?.description
            ? this.props.translations.description(this.name)
            : `User "${this.name}" disconnected.`;
    }

    @computed private get translationKick(): string {
        return this.props.translations?.kick ?? "Kick";
    }

    public render(): JSX.Element {
        const { translations: _translations, urlFactory: _urlFactory, peer: _peer, popupProps, ...rest } = this.props;
        return (
            <Message negative {...rest} icon>
                <Icon name="warning circle" />
                <Message.Content>
                    <Message.Header>{this.translationHeader}</Message.Header>
                    {this.translationDescription}
                </Message.Content>
                <Message.Content style={{ textAlign: "right" }}>
                    <Button
                        basic
                        content={this.translationKick}
                        icon="ban"
                        loading={this.kickLoading}
                        disabled={this.kickLoading}
                        onClick={this.handleKickClick}
                    />
                    <Popup
                        {...popupProps}
                        on="click"
                        inverted
                        trigger={
                            <Button icon="globe" onClick={this.handleIdClick} basic content={this.translationCopyUrl} />
                        }
                        content={this.popupText}
                    />
                </Message.Content>
            </Message>
        );
    }
}
