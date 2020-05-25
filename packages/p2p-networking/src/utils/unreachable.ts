export function unreachable(_arg: never): never {
    /* istanbul ignore next */
    throw new Error(`Unreachable code reached.`);
}

