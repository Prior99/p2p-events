import * as React from "react";
import { observer } from "mobx-react";
import { observable, action } from "mobx";
import { Form } from "semantic-ui-react";

export interface CreateTodoFormProps {
    onCreate: (title: string) => void;
}

@observer
export class CreateTodoForm extends React.Component<CreateTodoFormProps> {
    @observable private title = "";

    @action.bound private handleSubmit(evt: React.SyntheticEvent<HTMLFormElement>): void {
        evt.preventDefault();
        this.props.onCreate(this.title);
        this.title = "";
    }

    public render(): JSX.Element {
        return (
            <Form onSubmit={this.handleSubmit}>
                <Form.Group inline>
                    <Form.Field>
                        <label>Title</label>
                        <Form.Input value={this.title} onChange={(evt) => (this.title = evt.currentTarget.value)} />
                    </Form.Field>
                    <Form.Field>
                        <label>Create</label>
                        <Form.Button>Okay</Form.Button>
                    </Form.Field>
                </Form.Group>
            </Form>
        );
    }
}
