import * as React from "react";
import { observer } from "mobx-react";
import { TodoUser, Todo } from "./types";
import { PingInfo } from "p2p-network";
import { CreateTodoForm } from "./create-todo-form";
import { CollaborationLink } from "./collaboration-link";
import { TodoList } from "./todo-list";
import { CollaboratorList } from "./collaborator-list";
import { UpdateUserForm } from "./update-user-form";

export interface AppProps {
    todos: Todo[];
    user: TodoUser;
    onTodoCheck: (id: number) => void;
    onTodoDelete: (id: number) => void;
    onTodoCreate: (title: string) => void;
    connectionId: string;
    users: TodoUser[];
    onUpdateUser: (user: Partial<TodoUser>) => void;
    pingInfo: Map<string, PingInfo>;
}

@observer
export class App extends React.Component<AppProps> {
    public render(): JSX.Element {
        const {
            todos,
            user,
            onTodoCheck,
            onTodoCreate,
            onTodoDelete,
            onUpdateUser,
            connectionId,
            users,
            pingInfo,
        } = this.props;
        return (
            <div>
                <p>
                    Click here to invite collaborators: <CollaborationLink peerId={connectionId} />.
                </p>
                <TodoList todos={todos} onCheck={onTodoCheck} onDelete={onTodoDelete} />
                <CollaboratorList collaborators={users} pingInfo={pingInfo} />
                <UpdateUserForm user={user} onChange={onUpdateUser} />
                <CreateTodoForm onCreate={onTodoCreate} />
            </div>
        );
    }
}
