import * as React from "react";
import { observer } from "mobx-react";
import { TodoUser, Todo, Messages } from "./types";
import { CreateTodoForm } from "./create-todo-form";
import { TodoList } from "./todo-list";
import { UpdateUserForm } from "./update-user-form";
import { ObservablePeer } from "p2p-networking-mobx";
import {
    UserTable,
    IdMessage,
    ReconnectMessage,
    ReconnectModal,
    ConnectLoader,
} from "p2p-networking-semantic-ui-react";
import { Button, Card, Grid } from "semantic-ui-react";

export interface AppProps {
    todos: Todo[];
    onTodoCheck: (id: number) => void;
    onTodoDelete: (id: number) => void;
    onTodoCreate: (title: string) => void;
    onUserKick?: (id: string) => void;
    onUpdateUser: (user: Partial<TodoUser>) => void;
    peer: ObservablePeer<TodoUser, Messages>;
}

@observer
export class App extends React.Component<AppProps> {
    public render(): JSX.Element {
        const { todos, onTodoCheck, onTodoCreate, onTodoDelete, onUpdateUser, peer } = this.props;
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                    marginTop: 20,
                    padding: 20,
                }}
            >
                <ConnectLoader peer={peer} />
                <ReconnectModal peer={peer} />
                <Grid style={{ width: 800 }}>
                    <Card fluid>
                        <Card.Content header="Todo List" />
                        <Card.Content>
                            <TodoList todos={todos} onCheck={onTodoCheck} onDelete={onTodoDelete} />
                            <CreateTodoForm onCreate={onTodoCreate} />
                        </Card.Content>
                    </Card>
                    <Card fluid>
                        <Card.Content header="Collaborators" />
                        <Card.Content>
                            <UserTable peer={peer} nameFactory={(user) => user.name} />
                            <UpdateUserForm user={peer.user} onChange={onUpdateUser} />
                            <Button icon="broken chain" onClick={() => peer.close()} content="Disconnect" />
                        </Card.Content>
                    </Card>
                    {peer.isHost &&
                        peer.disconnectedUsers.map((user) => (
                            <ReconnectMessage
                                key={user.id}
                                peer={peer}
                                userId={user.id}
                                nameFactory={(user) => user.name}
                                urlFactory={(peerId, user) =>
                                    `${location.origin}${location.pathname}#${peerId}/${user.id}`
                                }
                            />
                        ))}
                    <IdMessage peer={peer} urlFactory={(id) => `${location.origin}${location.pathname}#${id}`} />
                </Grid>
            </div>
        );
    }
}
