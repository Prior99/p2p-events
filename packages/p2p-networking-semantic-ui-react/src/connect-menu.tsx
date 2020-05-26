import * as React from "react";
import { observer } from "mobx-react";
import { observable, action, computed } from "mobx";
import { Form, Tab, Input, FormProps, TabProps } from "semantic-ui-react";
import { NetworkMode } from "p2p-networking";

export type OnSubmitParameters = [NetworkMode.CLIENT, string] | [NetworkMode.HOST];

export interface ConnectMenuProps extends Omit<FormProps, "onSubmit"> {
    onSubmit: (...args: OnSubmitParameters) => void;
    translations?: {
        join?: string;
        host?: string;
    };
}

@observer
export class ConnectMenu extends React.Component<ConnectMenuProps> {
    @observable private otherId = "";
    @observable private activeTab = 0;

    @action.bound private handleOtherIdChange(evt: React.SyntheticEvent<HTMLInputElement>): void {
        this.otherId = evt.currentTarget.value;
    }

    @action.bound private handleTabChange(_: unknown, { activeIndex }: TabProps): void {
        this.activeTab = activeIndex as number;
    }

    @computed private get panes(): { menuItem: string }[] {
        return [{ menuItem: this.translationJoin }, { menuItem: this.translationHost }];
    }

    @action.bound private handleSubmit(evt: React.SyntheticEvent<HTMLFormElement>): void {
        evt.preventDefault();
        if (this.activeTab === 0) {
            this.props.onSubmit(NetworkMode.CLIENT, this.otherId);
        } else {
            this.props.onSubmit(NetworkMode.HOST);
        }
    }

    @computed private get translationJoin(): string {
        return this.props.translations?.join ?? "Join";
    }

    @computed private get translationHost(): string {
        return this.props.translations?.host ?? "Host";
    }

    public render(): JSX.Element {
        const { onSubmit: _, ...rest } = this.props;
        return (
            <Form {...rest} onSubmit={this.handleSubmit}>
                <Tab panes={this.panes} activeIndex={this.activeTab} onTabChange={this.handleTabChange} />
                <p />
                {this.activeTab === 0 && (
                    <>
                        <Form.Field>
                            <label>Join</label>
                            <Input value={this.otherId} onChange={this.handleOtherIdChange} />
                        </Form.Field>
                        <Form.Field>
                            <Form.Button icon="sign-in" primary fluid content={this.translationJoin} />
                        </Form.Field>
                    </>
                )}
                {this.activeTab === 1 && (
                    <Form.Field>
                        <Form.Button icon="globe" primary fluid content={this.translationHost} />
                    </Form.Field>
                )}
            </Form>
        );
    }
}
