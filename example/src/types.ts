import { User } from "p2p-events";

export interface Todo {
    id: number;
    title: string;
    createdBy: string;
    checkedBy?: string;
}
export const enum Messages {
    ADD_TODO = "add todo",
    DELETE_TODO = "delete todo",
    CHECK_TODO = "check todo",
}

export interface AddTodo {
    id: number;
    title: string;
}

export interface DeleteTodo {
    id: number;
}

export interface CheckTodo {
    id: number;
}

export interface TodoUser extends User {
    name: string;
}