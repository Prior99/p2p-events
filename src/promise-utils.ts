export type PromiseListener<TResolve extends any[], TReject extends any[]> = {
    resolve: (...args: TResolve) => void;
    reject: (...args: TReject) => void;
};

export function resolvePromiseListeners<TResolve extends any[], TReject extends any[]>(
    listeners: PromiseListener<TResolve, TReject>[],
    ...args: TResolve
): void {
    listeners.forEach((listener) => listener.resolve(...args));
}

export function rejectPromiseListeners<TResolve extends any[], TReject extends any[]>(
    listeners: PromiseListener<TResolve, TReject>[],
    ...args: TReject
): void {
    listeners.forEach((listener) => listener.reject(...args));
}
