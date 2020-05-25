import * as React from "react";
import { observer } from "mobx-react";
import { Todo } from "./types";

export interface TodoListItemProps {
    todo: Todo;
    onCheck: () => void;
    onDelete: () => void;
}

@observer
export class TodoListItem extends React.Component<TodoListItemProps> {
    public render(): JSX.Element {
        const { todo, onCheck, onDelete } = this.props;
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
}
