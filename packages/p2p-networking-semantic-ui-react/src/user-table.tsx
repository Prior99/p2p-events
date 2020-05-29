import * as React from "react";
import { observer } from "mobx-react";
import { Table, Icon, TableRowProps, TableProps } from "semantic-ui-react";
import { computed, action, observable } from "mobx";
import { ObservablePeer, ObservableHost } from "p2p-networking-mobx";
import { User } from "p2p-networking";
import { UserTableRow } from "./user-table-row";

export interface UserTableProps<TUser extends User, TMessageType extends string | number> extends TableProps {
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
    @observable private kickLoading = new Set<string>();

    @computed private get translationName(): string {
        return this.props.translations?.name ?? "User";
    }

    @action.bound private async handleKick(userId: string): Promise<void> {
        if (!(this.props.peer instanceof ObservableHost)) {
            return;
        }
        this.kickLoading.add(userId);
        await this.props.peer.kickUser(userId);
        this.kickLoading.delete(userId);
    }

    @computed private get users(): { user: TUser; disconnected: boolean }[] {
        const { peer, nameFactory } = this.props;
        return [
            ...peer.users.map((user) => ({ user, disconnected: false })),
            ...peer.disconnectedUsers.map((user) => ({ user, disconnected: true })),
        ].sort((a, b) => nameFactory(a.user).localeCompare(nameFactory(b.user)));
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
                        {peer instanceof ObservableHost && <Table.HeaderCell width="1"></Table.HeaderCell>}
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {this.users.map(({ user, disconnected }) => (
                        <UserTableRow
                            own={peer.userId === user.id}
                            kickLoading={this.kickLoading.has(user.id)}
                            onKick={peer instanceof ObservableHost ? this.handleKick : undefined}
                            canKick={peer.userId !== user.id}
                            nameFactory={nameFactory}
                            roundTripTime={peer.pingInfos.get(user.id)?.roundTripTime ?? 0}
                            key={user.id}
                            user={user}
                            customCells={customCells ? customCells(user) : undefined}
                            disconnected={disconnected}
                            {...(rowProps ? rowProps(user) : [])}
                        />
                    ))}
                    {children}
                </Table.Body>
            </Table>
        );
    }
}
