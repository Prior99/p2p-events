import * as React from "react";
import { Messages, AddTodo, CheckTodo, DeleteTodo, TodoUser, Todo } from "./types";
import { Peer, PingInfo } from "p2p-events";
import { CreateTodoForm } from "./create-todo-form";
import { CollaborationLink } from "./collaboration-link";
import { TodoList } from "./todo-list";
import { UpdateUserForm } from "./update-user-form";
import { CollaboratorList } from "./collaborator-list";

export interface AppProps {
    peer: Peer<TodoUser, Messages>;
}

export function App({ peer }: AppProps): JSX.Element {
    const addTodo = peer.event<AddTodo>(Messages.ADD_TODO);
    const checkTodo = peer.event<CheckTodo>(Messages.CHECK_TODO);
    const deleteTodo = peer.event<DeleteTodo>(Messages.DELETE_TODO);
    const [collaborators, setCollaborators] = React.useState(peer.users.allUsers);
    const [pingInfo, setPingInfo] = React.useState<Map<string, PingInfo>>(new Map());

    const [todos, setTodos] = React.useState<Todo[]>([]);
    addTodo.subscribe(({ title, id }, createdBy) => setTodos([...todos, { title, id, createdBy }]));
    checkTodo.subscribe(({ id }, checkedBy) =>
        setTodos(
            todos.map((todo) =>
                todo.id === id ? { ...todo, checkedBy: todo.checkedBy ? undefined : checkedBy } : todo,
            ),
        ),
    );
    deleteTodo.subscribe(({ id }) => setTodos(todos.filter((todo) => todo.id !== id)));
    peer.on("userconnect", () => setCollaborators(peer.users.allUsers));
    peer.on("userdisconnect", () => setCollaborators(peer.users.allUsers));
    peer.on("userupdate", () => setCollaborators(peer.users.allUsers));
    peer.on("pinginfo", (pingInfo) => setPingInfo(pingInfo));

    return (
        <div>
            <p>
                Click here to invite collaborators: <CollaborationLink peerId={peer.hostPeerId} />.
            </p>
            <TodoList
                todos={todos}
                onCheck={(id) => checkTodo.send({ id })}
                onDelete={(id) => deleteTodo.send({ id })}
            />
            <CollaboratorList collaborators={collaborators} pingInfo={pingInfo} />
            <UpdateUserForm user={peer.ownUser} onChange={(update) => peer.updateUser(update)} />
            <CreateTodoForm
                onCreate={(title) =>
                    addTodo.send({
                        id: Math.round(Math.random() * 1000),
                        title,
                    })
                }
            />
        </div>
    );
}
