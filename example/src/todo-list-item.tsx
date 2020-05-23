import * as React from "react";
import { Todo } from "./types";

export interface TodoListItemProps {
    todo: Todo;
    onCheck: () => void;
    onDelete: () => void;
}

export function TodoListItem({ todo, onCheck, onDelete }: TodoListItemProps): JSX.Element {
    return (
        <li key={todo.id}>
            <label>
                <input type="checkbox" checked={Boolean(todo.checkedBy)} onChange={() => onCheck()} />
                {todo.title}
            </label>
            <button onClick={onDelete}>Okay</button>
        </li>
    );
}
