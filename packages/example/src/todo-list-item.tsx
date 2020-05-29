import * as React from "react";
import { observer } from "mobx-react";
import { Todo } from "./types";
import { Table, Input, Button } from "semantic-ui-react";

export interface TodoListItemProps {
    todo: Todo;
    number: number;
    onCheck: () => void;
    onDelete: () => void;
}

@observer
export class TodoListItem extends React.Component<TodoListItemProps> {
    public render(): JSX.Element {
        const { todo, number, onCheck, onDelete } = this.props;
        return (
            <Table.Row key={todo.id} positive={Boolean(todo.checkedBy)}>
                <Table.Cell>{number}</Table.Cell>
                <Table.Cell>{todo.title}</Table.Cell>
                <Table.Cell>
                    <Input type="checkbox" checked={Boolean(todo.checkedBy)} onChange={() => onCheck()} />
                </Table.Cell>
                <Table.Cell>
                    <Button onClick={onDelete} icon="trash"/>
                </Table.Cell>
            </Table.Row>
        );
    }
}
