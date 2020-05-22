export type PromiseListener<TResolve extends unknown[], TReject extends unknown[]> = {
    resolve: (...args: TResolve) => void;
    reject: (...args: TReject) => void;
};

export function resolvePromiseListeners<TResolve extends unknown[], TReject extends unknown[]>(
    listeners: PromiseListener<TResolve, TReject>[],
    ...args: TResolve
): void {
    listeners.forEach((listener) => listener.resolve(...args));
}

export function rejectPromiseListeners<TResolve extends unknown[], TReject extends unknown[]>(
    listeners: PromiseListener<TResolve, TReject>[],
    ...args: TReject
): void {
    listeners.forEach((listener) => listener.reject(...args));
}
