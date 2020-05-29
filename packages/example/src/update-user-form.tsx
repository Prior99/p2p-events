import * as React from "react";
import { action, computed, observable } from "mobx";
import { observer } from "mobx-react";
import { TodoUser } from "./types";
import { Form } from "semantic-ui-react";

export interface UpdateUserFormProps {
    onChange: (update: Omit<Partial<TodoUser>, "id">) => void;
    user?: TodoUser;
}

@observer
export class UpdateUserForm extends React.Component<UpdateUserFormProps> {
    @observable private formName: string | undefined;

    @computed private get name(): string {
        return this.formName ?? this.props.user?.name ?? "";
    }

    @action.bound private handleSubmit(evt: React.SyntheticEvent<HTMLFormElement>): void {
        evt.preventDefault();
        this.props.onChange({ name: this.name });
        this.formName = undefined;
    }

    public render(): JSX.Element {
        return (
            <Form onSubmit={this.handleSubmit}>
                <Form.Group inline>
                    <Form.Field>
                        <label>Name</label>
                        <Form.Input value={this.name} onChange={(evt) => (this.formName = evt.currentTarget.value)} />
                    </Form.Field>
                    <Form.Field>
                        <label>Change</label>
                        <Form.Button>Okay</Form.Button>
                    </Form.Field>
                </Form.Group>
            </Form>
        );
    }
}
