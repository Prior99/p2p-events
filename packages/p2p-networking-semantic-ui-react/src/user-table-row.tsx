import * as React from "react";
import { observer } from "mobx-react";
import { Table, TableRowProps, Button, Icon } from "semantic-ui-react";
import { computed } from "mobx";
import { User } from "p2p-networking";

export interface UserTableRowProps<TUser extends User> extends TableRowProps {
    user: TUser;
    customCells?: JSX.Element;
    nameFactory: (user: TUser) => string;
    roundTripTime: number;
    onKick?: (userId: string) => void;
    kickLoading?: boolean;
    disconnected?: boolean;
    canKick?: boolean;
    own?: boolean;
}

@observer
export class UserTableRow<TUser extends User> extends React.Component<UserTableRowProps<TUser>> {
    @computed private get name(): string {
        return this.props.nameFactory(this.props.user);
    }

    @computed private get roundTripTime(): string {
        return `${this.props.roundTripTime * 1000}ms`;
    }

    public render(): JSX.Element {
        const {
            customCells,
            user,
            nameFactory: _nameFactory,
            roundTripTime: _roundTripTime,
            onKick,
            kickLoading,
            disconnected,
            canKick,
            own,
            ...rest
        } = this.props;
        return (
            <Table.Row positive={own} error={disconnected} {...rest}>
                <Table.Cell>{this.name}</Table.Cell>
                {customCells ? customCells : <></>}
                <Table.Cell textAlign="right">{disconnected ? <Icon name="broken chain" /> : this.roundTripTime}</Table.Cell>
                {onKick && (
                    <Table.Cell>
                        <Button
                            size="mini"
                            onClick={() => onKick(user.id)}
                            loading={kickLoading}
                            disabled={kickLoading || !canKick}
                            icon="ban"
                            basic
                        />
                    </Table.Cell>
                )}
            </Table.Row>
        );
    }
}
