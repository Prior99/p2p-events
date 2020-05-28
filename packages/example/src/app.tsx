import * as React from "react";
import { observer } from "mobx-react";
import { TodoUser, Todo, Messages } from "./types";
import { CreateTodoForm } from "./create-todo-form";
import { CollaborationLink } from "./collaboration-link";
import { TodoList } from "./todo-list";
import { CollaboratorList } from "./collaborator-list";
import { UpdateUserForm } from "./update-user-form";
import { ObservablePeer } from "p2p-networking-mobx";
import { NetworkMode } from "p2p-networking";

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
        const { todos, onTodoCheck, onTodoCreate, onTodoDelete, onUpdateUser, onUserKick, peer } = this.props;
        switch (peer.networkMode) {
            case NetworkMode.CONNECTING:
                return <p>Connecting...</p>;
            case NetworkMode.DISCONNECTED:
                return <p>Not connected.</p>;
            default:
                return (
                    <div>
                        <p>
                            Click here to invite collaborators: <CollaborationLink peerId={peer.hostConnectionId} />.
                        </p>
                        <TodoList todos={todos} onCheck={onTodoCheck} onDelete={onTodoDelete} />
                        <CollaboratorList peer={peer} onUserKick={onUserKick} />
                        <UpdateUserForm user={peer.user} onChange={onUpdateUser} />
                        <CreateTodoForm onCreate={onTodoCreate} />
                    </div>
                );
        }
    }
}
