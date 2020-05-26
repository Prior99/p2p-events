import * as React from "react";
import { observer } from "mobx-react";
import { Table, TableRowProps } from "semantic-ui-react";
import { computed } from "mobx";
import { User } from "p2p-networking";

export interface UserTableRowProps<TUser extends User> extends TableRowProps {
    user: TUser;
    customCells?: JSX.Element;
    nameFactory: (user: TUser) => string;
    roundTripTime: number;
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
            user: _user,
            nameFactory: _nameFactory,
            roundTripTime: _roundTripTime,
            ...rest
        } = this.props;
        return (
            <Table.Row {...rest}>
                <Table.Cell>{this.name}</Table.Cell>
                {customCells ? customCells : <></>}
                <Table.Cell textAlign="right">{this.roundTripTime}</Table.Cell>
            </Table.Row>
        );
    }
}
