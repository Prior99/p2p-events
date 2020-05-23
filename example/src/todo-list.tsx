import * as React from "react";
import { observer } from "mobx-react";
import { TodoListItem } from "./todo-list-item";
import { Todo } from "./types";

export interface TodoListProps {
    todos: Todo[];
    onCheck: (id: number) => void;
    onDelete: (id: number) => void;
}

@observer
export class TodoList extends React.Component<TodoListProps> {
    public render(): JSX.Element {
        const { todos, onCheck, onDelete } = this.props;
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
}
