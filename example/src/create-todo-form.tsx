import * as React from "react";

export interface CreateTodoFormProps {
    onCreate: (title: string) => void;
}

export function CreateTodoForm({ onCreate }: CreateTodoFormProps): JSX.Element {
    const [title, setTitle] = React.useState("");
    const handleSubmit = (evt: React.SyntheticEvent<HTMLFormElement>): void => {
        evt.preventDefault();
        onCreate(title);
        setTitle("");
    };
    return (
        <form onSubmit={handleSubmit}>
            <label>
                Title
                <input value={title} onChange={(evt) => setTitle(evt.currentTarget.value)} />
            </label>
            <label>
                Create
                <button>Okay</button>
            </label>
        </form>
    );
}
