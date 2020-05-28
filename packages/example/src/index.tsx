import * as React from "react";
import * as ReactDOM from "react-dom";
import { ObservablePeer, createObservableClient, createObservableHost, ObservableHost } from "p2p-networking-mobx";
import { Messages, TodoUser, AddTodo, CheckTodo, DeleteTodo, Todo, CurrentState } from "./types";
import { App } from "./app";
import { observable, reaction } from "mobx";
import { PeerOptions } from "p2p-networking";

const applicationProtocolVersion = "1.0.0";

async function createPeer(): Promise<ObservablePeer<TodoUser, Messages>> {
    const options: PeerOptions<TodoUser> = {
        applicationProtocolVersion,
        peerJsOptions: {
            host: "peerjs.92k.de",
            secure: true,
        },
    };
    const user = { name: "Unknown" };
    if (location.hash) {
        const [peerId, userId] = location.hash.replace("#", "").split("/");
        return await createObservableClient(options, peerId, userId ? userId : user);
    }
    return await createObservableHost({ ...options, pingInterval: 5 }, user);
}

async function main(): Promise<void> {
    const peer = await createPeer();

    const addTodo = peer.message<AddTodo>(Messages.ADD_TODO);
    const checkTodo = peer.message<CheckTodo>(Messages.CHECK_TODO);
    const deleteTodo = peer.message<DeleteTodo>(Messages.DELETE_TODO);
    const currentState = peer.message<CurrentState>(Messages.CURRENT_STATE);

    const todos = observable.array<Todo>([]);

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
        if (peer.isHost) {
            currentState.send({ todos }, user.id);
        }
    });

    peer.on("userreconnect", (user) => {
        if (peer.isHost) {
            currentState.send({ todos }, user.id);
        }
    });

    ReactDOM.render(
        <App
            todos={todos}
            onTodoCheck={(id) => checkTodo.send({ id })}
            onTodoDelete={(id) => deleteTodo.send({ id })}
            onTodoCreate={(title) => addTodo.send({ id: Math.round(Math.random() * 10000), title })}
            onUserKick={peer instanceof ObservableHost ? (id) => peer.kickUser(id) : undefined}
            onUpdateUser={(update) => peer.updateUser(update)}
            peer={peer}
        />,
        document.getElementById("app"),
    );
}

main();
