import * as React from "react";
import { action, computed, observable } from "mobx";
import { observer } from "mobx-react";
import { TodoUser } from "./types";

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
            <form onSubmit={this.handleSubmit}>
                <label>
                    Name
                    <input value={this.name} onChange={(evt) => (this.formName = evt.currentTarget.value)} />
                </label>
                <label>
                    Change
                    <button>Okay</button>
                </label>
            </form>
        );
    }
}
