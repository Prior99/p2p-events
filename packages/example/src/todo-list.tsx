import * as React from "react";
import { observer } from "mobx-react";
import { TodoListItem } from "./todo-list-item";
import { Todo } from "./types";
import { Table } from "semantic-ui-react";

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
            <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>#</Table.HeaderCell>
                        <Table.HeaderCell>Title</Table.HeaderCell>
                        <Table.HeaderCell width="1"></Table.HeaderCell>
                        <Table.HeaderCell width="1"></Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {todos.map((todo, index) => (
                        <TodoListItem
                            todo={todo}
                            key={todo.id}
                            onCheck={() => onCheck(todo.id)}
                            onDelete={() => onDelete(todo.id)}
                            number={index + 1}
                        />
                    ))}
                </Table.Body>
            </Table>
        );
    }
}
