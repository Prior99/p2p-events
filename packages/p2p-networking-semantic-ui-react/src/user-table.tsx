import * as React from "react";
import { observer } from "mobx-react";
import { Table, Icon, TableRowProps } from "semantic-ui-react";
import { computed } from "mobx";
import { ObservablePeer } from "p2p-networking-mobx";
import { User } from "p2p-networking";
import { UserTableRow } from "./user-table-row";

export interface UserTableProps<TUser extends User, TMessageType extends string | number> {
    peer: ObservablePeer<TUser, TMessageType>;
    translations?: {
        name?: string;
    };
    headerCells?: () => JSX.Element;
    customCells?: (user: TUser) => JSX.Element;
    nameFactory: (user: TUser) => string;
    rowProps?: (user: TUser) => TableRowProps;
}

@observer
export class UserTable<TUser extends User, TMessageType extends string | number> extends React.Component<
    UserTableProps<TUser, TMessageType>
> {
    @computed private get translationName(): string {
        return this.props.translations?.name ?? "User";
    }

    public render(): JSX.Element {
        const {
            headerCells,
            peer,
            customCells,
            rowProps,
            children,
            translations: _translations,
            nameFactory,
            ...rest
        } = this.props;
        return (
            <Table {...rest}>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>{this.translationName}</Table.HeaderCell>
                        {headerCells ? headerCells() : <></>}
                        <Table.HeaderCell textAlign="right">
                            <Icon name="clock" />
                        </Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {peer.users.map((user) => (
                        <UserTableRow
                            nameFactory={nameFactory}
                            roundTripTime={peer.pingInfos.get(user.id)?.roundTripTime ?? 0}
                            key={user.id}
                            user={user}
                            customCells={customCells ? customCells(user) : undefined}
                            {...(rowProps ? rowProps(user) : [])}
                        />
                    ))}
                    {children}
                </Table.Body>
            </Table>
        );
    }
}
