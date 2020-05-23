import * as React from "react";
import { TodoUser } from "./types";

export interface UpdateUserFormProps {
    onChange: (update: Omit<Partial<TodoUser>, "id">) => void;
    user: TodoUser;
}

export function UpdateUserForm({ onChange, user }: UpdateUserFormProps): JSX.Element {
    const [name, setName] = React.useState<string | undefined>(undefined);
    const handleSubmit = (evt: React.SyntheticEvent<HTMLFormElement>): void => {
        evt.preventDefault();
        onChange({ name });
        setName(undefined);
    };
    const normalizedName = name ?? user.name;

    return (
        <form onSubmit={handleSubmit}>
            <label>
                Name
                <input value={normalizedName} onChange={(evt) => setName(evt.currentTarget.value)} />
            </label>
            <label>
                Change
                <button>Okay</button>
            </label>
        </form>
    );
}
