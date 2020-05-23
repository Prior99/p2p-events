import * as React from "react";
import { observer } from "mobx-react";
import { observable, action } from "mobx";

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
            <form onSubmit={this.handleSubmit}>
                <label>
                    Title
                    <input value={this.title} onChange={(evt) => (this.title = evt.currentTarget.value)} />
                </label>
                <label>
                    Create
                    <button>Okay</button>
                </label>
            </form>
        );
    }
}
