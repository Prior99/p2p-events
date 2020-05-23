import * as React from "react";
import * as ReactDOM from "react-dom";
import { Peer, PingInfo, createClient, createHost } from "p2p-network";
import { Messages, TodoUser, AddTodo, CheckTodo, DeleteTodo, Todo, CurrentState } from "./types";
import { App } from "./app";
import { observable } from "mobx";

const applicationProtocolVersion = "1.0.0";

async function createPeer(): Promise<Peer<TodoUser, Messages>> {
    const options = {
        user: { name: "Unknown" },
        applicationProtocolVersion,
    };
    if (location.hash) {
        return await createClient(options, location.hash.replace("#", ""));
    }
    return await createHost({ ...options, pingInterval: 5 });
}

async function main(): Promise<void> {
    const peer = await createPeer();

    const addTodo = peer.message<AddTodo>(Messages.ADD_TODO);
    const checkTodo = peer.message<CheckTodo>(Messages.CHECK_TODO);
    const deleteTodo = peer.message<DeleteTodo>(Messages.DELETE_TODO);
    const currentState = peer.message<CurrentState>(Messages.CURRENT_STATE);

    const todos = observable.array<Todo>([]);
    const users = observable.array<TodoUser>(peer.users);
    const pingInfo = observable.map<string, PingInfo>();

    addTodo.subscribe(({ title, id }, createdBy) => todos.push({ title, id, createdBy }));
    checkTodo.subscribe(({ id }, checkedBy) => {
        const todo = todos.find((todo) => todo.id === id)!;
        if (todo.checkedBy) {
            todo.checkedBy = undefined;
        } else {
            todo.checkedBy = checkedBy;
        }
    });
    deleteTodo.subscribe(({ id }) => todos.replace(todos.filter((todo) => todo.id !== id)));
    currentState.subscribe(({ todos: currentTodods }) => todos.replace(currentTodods));

    peer.on("userconnect", (user) => {
        users.replace(peer.users);
        if (peer.isHost) {
            currentState.send({ todos }, user.id);
        }
    });
    peer.on("userdisconnect", () => users.replace(peer.users));
    peer.on("userupdate", () => users.replace(peer.users));
    peer.on("pinginfo", (newPingInfo) => pingInfo.replace(newPingInfo));

    ReactDOM.render(
        <App
            todos={todos}
            user={peer.ownUser}
            users={users}
            onTodoCheck={(id) => checkTodo.send({ id })}
            onTodoDelete={(id) => deleteTodo.send({ id })}
            onTodoCreate={(title) => addTodo.send({ id: Math.round(Math.random() * 10000), title })}
            onUpdateUser={(update) => peer.updateUser(update)}
            connectionId={peer.hostConnectionId ?? ""}
            pingInfo={pingInfo}
        />,
        document.getElementById("app"),
    );
}

main();
