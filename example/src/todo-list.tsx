import * as React from "react";
import { TodoListItem } from "./todo-list-item";
import { Todo } from "./types";

export interface TodoListProps {
    todos: Todo[];
    onCheck: (id: number) => void;
    onDelete: (id: number) => void;
}

export function TodoList({ todos, onCheck, onDelete }: TodoListProps): JSX.Element {
    return (
        <ol>
            {todos.map((todo) => (
                <TodoListItem
                    todo={todo}
                    key={todo.id}
                    onCheck={() => onCheck(todo.id)}
                    onDelete={() => onDelete(todo.id)}
                />
            ))}
        </ol>
    );
}
