export function unreachable(arg: never): never {
    throw new Error(`Unreachable code: "${JSON.stringify(arg)}" was not expected.`);
}

